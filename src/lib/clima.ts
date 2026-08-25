// Coordenadas da capital de cada UF — suficiente pra uma tendência regional,
// sem precisar geocodificar a cidade exata de cada produtor.
export const capitalPorUf: Record<string, [number, number]> = {
  AC: [-9.97, -67.81],
  AL: [-9.65, -35.72],
  AP: [0.04, -51.05],
  AM: [-3.1, -60.02],
  BA: [-12.97, -38.51],
  CE: [-3.72, -38.54],
  DF: [-15.78, -47.93],
  ES: [-20.32, -40.34],
  GO: [-16.68, -49.25],
  MA: [-2.53, -44.3],
  MT: [-15.6, -56.1],
  MS: [-20.44, -54.65],
  MG: [-19.92, -43.94],
  PA: [-1.46, -48.5],
  PB: [-7.12, -34.88],
  PR: [-25.43, -49.27],
  PE: [-8.05, -34.9],
  PI: [-5.09, -42.8],
  RJ: [-22.91, -43.17],
  RN: [-5.79, -35.21],
  RS: [-30.03, -51.23],
  RO: [-8.76, -63.9],
  RR: [2.82, -60.67],
  SC: [-27.6, -48.55],
  SP: [-23.55, -46.63],
  SE: [-10.91, -37.07],
  TO: [-10.25, -48.32],
};

export type Previsao = {
  dias: string[];
  chuvaPct: number[];
  tempMax: number[];
  tempMin: number[];
};

export async function buscarPrevisao(uf: string): Promise<Previsao | null> {
  const coords = capitalPorUf[uf];
  if (!coords) return null;
  const [lat, lon] = coords;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  return {
    dias: json.daily.time,
    chuvaPct: json.daily.precipitation_probability_max,
    tempMax: json.daily.temperature_2m_max,
    tempMin: json.daily.temperature_2m_min,
  };
}
