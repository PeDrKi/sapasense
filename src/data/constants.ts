export const WX_MAP = {
  0:{icon:'☀️',label:'Trời đẹp'}, 1:{icon:'🌤',label:'Ít mây'},
  2:{icon:'⛅',label:'Nhiều mây'}, 3:{icon:'☁️',label:'U ám'},
  45:{icon:'🌫',label:'Sương mù'}, 61:{icon:'🌧',label:'Có mưa'},
  63:{icon:'🌧',label:'Mưa vừa'}, 80:{icon:'🌦',label:'Mưa rào'},
  95:{icon:'⛈',label:'Giông bão'},
  51:{icon:'🌦',label:'Mưa phùn'}, 53:{icon:'🌦',label:'Mưa phùn'}, 55:{icon:'🌧',label:'Mưa phùn dày'},
  65:{icon:'🌧',label:'Mưa to'}, 81:{icon:'🌦',label:'Mưa rào vừa'}, 82:{icon:'⛈',label:'Mưa rào lớn'},
  96:{icon:'⛈',label:'Giông, mưa đá'}, 99:{icon:'⛈',label:'Giông, mưa đá lớn'},
}

// Open-Meteo weather codes that should push the plan indoors
export const RAINY_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]
