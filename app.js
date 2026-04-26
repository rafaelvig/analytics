const SUPABASE_URL = "https://vjwxkruczzjnkzfjgrba.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqd3hrcnVjenpqbmt6ZmpncmJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzQ4MzUsImV4cCI6MjA4NTcxMDgzNX0.8y621Ls7hTiva2zihhOXqlAiIo7omcd73-RWO73FYAs";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function badge(value) {
  let color = "#31999e";

  if (value >= 85) color = "#16a34a";       // verde
  else if (value >= 60) color = "#f59e0b";  // amarillo
  else color = "#dc2626";                  // rojo

  return `<span class="badge" style="background:${color}20;color:${color}">${value ?? "-"}</span>`;
}
async function loadKPIs() {
  const { data, error } = await sb
    .from("vw_farmacias_scores_consolidado")
    .select("*");

  if (error) {
    console.error("loadKPIs error:", error);
    return [];
  }

  const rows = data || [];
  const totalFarmacias = rows.length;
  const totalRespuestas = rows.reduce((acc, r) => acc + Number(r.respuestas || 0), 0);
  const oportunidadProm = rows.length
    ? Math.round(rows.reduce((acc, r) => acc + Number(r.score_oportunidad || 0), 0) / rows.length)
    : 0;
  const digitalProm = rows.length
    ? Math.round(rows.reduce((acc, r) => acc + Number(r.score_digital || 0), 0) / rows.length)
    : 0;

  setText("kpiRespuestas", totalRespuestas);
  setText("kpiFarmacias", totalFarmacias);
  setText("kpiOportunidad", oportunidadProm);
  setText("kpiDigital", digitalProm);

  return rows;
}

async function loadRanking(tipo) {
  const { data, error } = await sb
    .from("vw_farmacias_rankings")
    .select("opcion, posicion")
    .eq("tipo", tipo);

  if (error) {
    console.error(`loadRanking ${tipo} error:`, error);
    return [];
  }

  const map = new Map();

  (data || []).forEach(row => {
    const actual = map.get(row.opcion) || 0;
    map.set(row.opcion, actual + (8 - Number(row.posicion || 7)));
  });

  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}


async function loadPercentages() {
  const { data, error } = await sb
    .from("vw_encuesta_porcentajes")
    .select("*");

  if (error) {
    console.error("loadPercentages error:", error);
    return {};
  }

  const map = {};

  (data || []).forEach(row => {
    if (!map[row.question_key]) map[row.question_key] = [];
    map[row.question_key].push(row);
  });

  return map;
}

function formatLabel(key) {
  const map = {
    q1_tipo_farmacia: "Tipo de farmacia",
    q10_presion_flujo: "Presión financiera",
    q11_dificultad_financiera: "Dificultad financiera",
    q21_satisfaccion: "Nivel de satisfacción"
  };

  return map[key] || key.replaceAll("_", " ");
}
function renderBarChart(elId, rows) {
  const el = document.getElementById(elId);
  if (!el) return;

  const options = {
    chart: {
      type: "bar",
      height: 320,
      toolbar: { show: false }
    },
    series: [{
      name: "Valor",
      data: rows.map(r => r.value)
    }],
    xaxis: {
      categories: rows.map(r => r.label)
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6
      }
    },
    dataLabels: {
      enabled: false
    },
    legend: {
      show: false
    }
  };

  const chart = new ApexCharts(el, options);
  chart.render();
}
function renderInsight(rows) {
  const el = document.getElementById("insightText");
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = "Sin datos.";
    return;
  }

  const top = [...rows].sort((a,b)=>b.score_oportunidad-a.score_oportunidad)[0];

  el.innerHTML = `
    <p><strong>Cuenta prioritaria:</strong> ${top.farmacia}</p>
    <p>Alta oportunidad comercial basada en combinación de apertura al cambio y presión financiera.</p>
    <p>Recomendación: ingreso mediante prueba controlada con foco en mejora de margen.</p>
  `;
}
function renderTablaFarmacias(rows) {
  const tbody = document.getElementById("tablaFarmacias");
  if (!tbody) return;

  tbody.innerHTML = rows
    .sort((a, b) => Number(b.score_oportunidad || 0) - Number(a.score_oportunidad || 0))
    .map(row => `
      <tr>
        <td>${row.farmacia}</td>
        <td>${row.respuestas}</td>
        <td>${badge(row.score_precio)}</td>
        <td>${badge(row.score_cambio)}</td>
        <td>${badge(row.score_digital)}</td>
        <td>${badge(row.score_financiero)}</td>
        <td>${badge(row.score_oportunidad)}</td>
      </tr>
    `)
    .join("");
}
function renderQuestions(map) {
  const container = document.getElementById("questionsContainer");
  if (!container) return;

  const blacklist = ["ranking"];

  container.innerHTML = Object.entries(map)
    .filter(([key]) => !blacklist.some(b => key.includes(b)))
    .map(([key, answers]) => `
      <div class="question-block">
        <h4>${formatLabel(key)}</h4>

        ${answers.map(a => `
          <div class="bar-row">
            <span class="label">${a.answer}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width:${a.percentage}%"></div>
            </div>
            <span class="value">${a.percentage}%</span>
          </div>
        `).join("")}
      </div>
    `)
    .join("");
}
async function init() {
  const rows = await loadKPIs();
  renderTablaFarmacias(rows);

  const percentages = await loadPercentages();
renderQuestions(percentages);

  const criterios = await loadRanking("criterios");
  const motivos = await loadRanking("motivos_cambio");
  const barreras = await loadRanking("barreras");

  renderBarChart("chartCriterios", criterios);
  renderBarChart("chartMotivos", motivos);
  renderBarChart("chartBarreras", barreras);
  renderInsight(rows);
}

init();
