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
function classifyFarmacia(f) {
  if (f.score_oportunidad >= 80) return "🔥 Oportunidad inmediata";
  if (f.score_precio >= 70) return "💰 Sensible a precio";
  if (f.score_digital >= 70) return "💻 Digitalizable";
  if (f.score_cambio < 50) return "🧊 Baja apertura";

  return "⚖️ Intermedia";
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

  el.innerHTML = "";

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
function renderTopOportunidades(rows) {
  const el = document.getElementById("topList");
  if (!el) return;

  const top = [...rows]
    .sort((a, b) => (b.score_oportunidad || 0) - (a.score_oportunidad || 0))
    .slice(0, 3);

  el.innerHTML = top.map((r, i) => `
    <div class="top-item">
      <strong>${i + 1}. ${r.farmacia}</strong><br>
      <span>${classifyFarmacia(r)}</span>
    </div>
  `).join("");
}
function renderTablaFarmacias(rows) {
  const tbody = document.getElementById("tablaFarmacias");
  if (!tbody) return;

  tbody.innerHTML = rows
    .sort((a, b) => Number(b.score_oportunidad || 0) - Number(a.score_oportunidad || 0))
    .map(row => `
      <tr>
        <td>
  <strong>${row.farmacia}</strong><br>
  <small>${classifyFarmacia(row)}</small>
</td>
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
const QUESTION_LABELS = {
  q1_tipo_farmacia: "Tipo de farmacia",
  q2_provincia: "Provincia",
  q2_ciudad: "Ciudad",
  q3_empleados: "Cantidad de empleados",
  q4_facturacion: "Nivel de facturación",
  q5_evaluaria: "Evaluaría nuevo proveedor",
  q6_principal_60: "Proveedor principal actual",
  q7_pct_compras: "Concentración de compras",
  q8_pct_pami: "Participación PAMI",
  q9_plazo_cobro: "Plazo promedio de cobro",
  q10_presion_flujo: "Presión sobre flujo de fondos",
  q11_dificultad_financiera: "Dificultad financiera",
  q13_cambio_por_desc: "Apertura al cambio por descuento",
  q14_frec_comp_precios: "Frecuencia de comparación de precios",
  q15_dispuesto_mejora: "Disposición a trabajar con nuevo proveedor",
  q16_quien_decide: "Quién decide la compra",
  q17_quien_pide: "Quién realiza los pedidos",
  q18_tiempo_pedidos: "Tiempo dedicado a pedidos",
  q19_frec_entregas: "Frecuencia de entregas requerida",
  q20_antiguedad: "Antigüedad de la farmacia",
  q21_satisfaccion: "Satisfacción actual",
  q22_nivel_cambio: "Nivel de apertura al cambio",
  q23_motivos_cambio: "Motivos de cambio",
  q24_ranking_barreras: "Barreras al cambio",
  q25_nivel_cambio: "Probabilidad de cambio",
  q26_urgencia_rent: "Urgencia por mejorar rentabilidad",
  q27_plataforma_digital: "Uso de plataforma digital",
  q28_interes_digital: "Interés en herramientas digitales",
  q29_grupos_wp: "Participación en grupos de WhatsApp"
};
function formatQuestionLabel(key) {
  const map = {
    q1_tipo_farmacia: "Tipo de farmacia",
    q2_provincia: "Provincia",
    q2_ciudad: "Ciudad",
    q3_empleados: "Cantidad de empleados",
    q4_facturacion: "Nivel de facturación",
    q7_pct_obras: "Participación obras sociales",
    q8_pct_pami: "Participación PAMI",
    q9_plazo_cobro: "Plazo promedio de cobro",
    q10_presion_flujo: "Presión financiera",
    q11_dificultad_financiera: "Dificultad financiera",
    q13_cambio_por_desc: "Apertura al cambio",
    q14_frec_comp_precios: "Frecuencia comparación de precios",
    q16_quien_decide: "Quién decide la compra",
    q17_quien_pide: "Quién realiza pedidos",
    q18_tiempo_pedidos: "Tiempo dedicado a pedidos",
    q19_frec_entregas: "Frecuencia de entregas",
    q20_antiguedad: "Antigüedad",
    q21_satisfaccion: "Nivel de satisfacción",
    q22_nivel_cambio: "Nivel de apertura al cambio",
    q26_urgencia_rent: "Urgencia por rentabilidad",
    q27_plataforma_digital: "Uso de plataforma digital",
    q29_grupos_wp: "Uso de grupos de WhatsApp"
  };

  if (map[key]) return map[key];

  // 🔥 LIMPIEZA AUTOMÁTICA
  return key
    .replace(/^q\d+_/, "") // elimina q1_, q2_, etc
    .replaceAll("_", " ")
    .replace(/\b\w/g, l => l.toUpperCase());
}
const QUESTION_GROUPS = {
  "Perfil de la farmacia": [
    "q1_tipo_farmacia",
    "q2_provincia",
    "q2_ciudad",
    "q3_empleados",
    "q20_antiguedad"
  ],

  "Precio y margen": [
    "q4_facturacion",
    "q8_pct_pami",
    "q7_pct_obras",
    "q9_plazo_cobro",
    "q14_frec_comp_precios"
  ],

  "Financiero": [
    "q10_presion_flujo",
    "q11_dificultad_financiera",
    "q26_urgencia_rent"
  ],

  "Logística y servicio": [
    "q19_frec_entregas",
    "q18_tiempo_pedidos"
  ],

  "Digital": [
    "q27_plataforma_digital",
    "q28_interes_digital",
    "q29_grupos_wp"
  ],

  "Decisión y relación": [
    "q16_quien_decide",
    "q17_quien_pide",
    "q21_satisfaccion"
  ],

  "Cambio de proveedor": [
    "q13_cambio_por_desc",
    "q22_nivel_cambio"
  ]
};

function renderQuestions(map) {
  const container = document.getElementById("questionsContainer");
  if (!container) return;

  let html = "";

  Object.entries(QUESTION_GROUPS).forEach(([groupName, keys]) => {
    const groupQuestions = keys.filter(k => map[k]);

    if (!groupQuestions.length) return;

    html += `
      <div class="group-block">
        <h3 class="group-title">${groupName}</h3>
    `;

    groupQuestions.forEach(key => {
      const answers = map[key];

      html += `
        <div class="question-block">
          <h4>${formatQuestionLabel(key)}</h4>

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
      `;
    });

    html += `</div>`;
  });

  container.innerHTML = html;
}
async function init() {
  const rows = await loadKPIs();

  renderTopOportunidades(rows); // ← ACA

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
