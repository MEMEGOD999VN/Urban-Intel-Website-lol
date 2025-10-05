
// Initialize map
var map = L.map('map', {preferCanvas:true}).setView([21.0278, 105.8342], 7);

// OSM base
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'}).addTo(map);

// VIIRS base via GIBS
function gibsBase(name, date, format){ date = date || '2012-01-01'; format = format || 'png'; var url = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' + name + '/default/' + date + '/GoogleMapsCompatible_Level8/{z}/{y}/{x}.' + format; return L.tileLayer(url, {maxZoom:9, attribution: 'NASA GIBS'}); }
var viirs = gibsBase('VIIRS_SNPP_CityLights_2012','2012-01-01','png');

// Base switcher
var baseMaps = {'OpenStreetMap': osm, 'VIIRS Night Lights': viirs};
L.control.layers(baseMaps, {}, {collapsed:false, position:'topright'}).addTo(map);

// Legend
var legend = L.control({position:'topleft'}); legend.onAdd = function(map){ var div = L.DomUtil.create('div','legend-box'); div.innerHTML = '<div style="background:rgba(7,18,36,0.9);padding:8px;border-radius:6px;color:#e6f0f6;font-size:13px"><strong>Basemap Selector</strong><br><small style="color:#9aa6b2">Toggle base maps</small></div>'; return div; }; legend.addTo(map);

// Charts
var powerCtx = document.getElementById('powerChart').getContext('2d');
var powerChart = new Chart(powerCtx, { type:'line', data:{ labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], datasets:[{ label:'Temperature (°C)', data:[], borderColor:'#ff9f43', tension:0.2 },{ label:'Solar Radiation (kWh/m²/day)', data:[], borderColor:'#00d1ff', tension:0.2 }]}, options:{ responsive:true, plugins:{ legend:{ labels:{ color:'#e6f0f6' } } }, scales:{ x:{ ticks:{ color:'#cfeffb' } }, y:{ ticks:{ color:'#cfeffb' } } } } });

var growthChart = new Chart(document.getElementById('growthChart').getContext('2d'), { type:'bar', data:{ labels:['2018','2019','2020','2021','2022'], datasets:[{ label:'Urban Growth (VIIRS)', data:[12,18,24,33,45], backgroundColor:'rgba(0,209,255,0.12)', borderColor:'#00d1ff' }]}, options:{ responsive:true, plugins:{ legend:{ labels:{ color:'#e6f0f6' } } }, scales:{ x:{ ticks:{ color:'#cfeffb' } }, y:{ ticks:{ color:'#cfeffb' } } } } });
var ndviChart = new Chart(document.getElementById('ndviChart').getContext('2d'), { type:'line', data:{ labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], datasets:[{ label:'NDVI (mean)', data:[0.32,0.36,0.42,0.51,0.58,0.63,0.61,0.55,0.49,0.44,0.38,0.34], borderColor:'#7cffb2' }]}, options:{ responsive:true, plugins:{ legend:{ labels:{ color:'#e6f0f6' } } }, scales:{ x:{ ticks:{ color:'#cfeffb' } }, y:{ ticks:{ color:'#cfeffb' } } } } });
var lstChart = new Chart(document.getElementById('lstChart').getContext('2d'), { type:'line', data:{ labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], datasets:[{ label:'LST (°C)', data:[25,26,29,32,34,35,34,33,31,29,27,25], borderColor:'#ff6b6b' }]}, options:{ responsive:true, plugins:{ legend:{ labels:{ color:'#e6f0f6' } } }, scales:{ x:{ ticks:{ color:'#cfeffb' } }, y:{ ticks:{ color:'#cfeffb' } } } } });

// NASA POWER fetch
async function fetchPower(lat, lon){
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,ALLSKY_SFC_SW_DWN&community=AG&longitude=${lon}&latitude=${lat}&format=JSON`;
  try{
    const r = await fetch(url);
    if(!r.ok) throw new Error('POWER API error');
    const js = await r.json();
    const params = js.properties && js.properties.parameter ? js.properties.parameter : (js.parameters || null);
    if(!params || !params.T2M) throw new Error('Missing POWER params');
    const t = params.T2M; const s = params.ALLSKY_SFC_SW_DWN;
    const months = Object.keys(t).sort((a,b)=>Number(a)-Number(b));
    const temps = months.map(m=>{ let v=t[m]; if(v>200) v=v-273.15; return Math.round(v*10)/10; });
    const solar = months.map(m=>Math.round((s[m]||0)*10)/10);
    updatePower(months.map(m=>'M'+m), temps, solar, false);
  }catch(e){
    console.warn('POWER failed, loading fallback', e);
    try{
      const res = await fetch('data/hanoi_power.json');
      const fallback = await res.json();
      let temps=[], solar=[];
      if(fallback.properties && fallback.properties.parameter){
        const t = fallback.properties.parameter.T2M, s = fallback.properties.parameter.ALLSKY_SFC_SW_DWN;
        const keys = Object.keys(t).sort((a,b)=>Number(a)-Number(b));
        temps = keys.map(k=>{ let v=t[k]; if(v>200) v=v-273.15; return Math.round(v*10)/10; });
        solar = keys.map(k=> Math.round((s[k]||0)*10)/10 );
      } else if(fallback.climatology){
        temps = fallback.climatology.T2M; solar = fallback.climatology.ALLSKY_SFC_SW_DWN;
      }
      updatePower(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], temps, solar, true);
    }catch(err){
      console.error('Fallback load failed', err);
      document.getElementById('powerNote').innerText = 'ERROR: could not load POWER data.';
    }
  }
}

function updatePower(labels, temps, solar, fallback){
  powerChart.data.labels = labels; powerChart.data.datasets[0].data = temps; powerChart.data.datasets[1].data = solar; powerChart.update();
  document.getElementById('powerNote').innerText = fallback ? '⚠️ Using cached Hanoi dataset (fallback).' : 'NASA POWER Data (live).';
}

map.on('click', function(e){ const lat = e.latlng.lat.toFixed(4), lon = e.latlng.lng.toFixed(4); fetchPower(lat, lon); L.popup().setLatLng(e.latlng).setContent('<strong>TerraIntel</strong><br>Fetching POWER data for: ' + lat + ', ' + lon).openOn(map); });

// initial load
fetchPower(21.0278,105.8342);
