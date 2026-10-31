import { useLang } from '../i18n'

/** Dòng cảnh báo ở chân trang: thông tin chỉ mang tính tham khảo. */
export default function Disclaimer() {
  const { lang } = useLang()
  const vi = lang !== 'EN'
  return (
    <footer role="contentinfo" style={{ padding:'1.25rem 1.25rem 5.5rem', textAlign:'center', fontSize:'0.68rem', lineHeight:1.6, color:'#7a756a' }}>
      {vi
        ? 'Thông tin về giá, giờ mở cửa, địa chỉ và thời tiết chỉ mang tính tham khảo và có thể thay đổi. Vui lòng gọi xác nhận với nơi bạn định đến trước khi đi. Trời mưa, sương mù hoặc đường đèo xấu: ưu tiên an toàn.'
        : 'Prices, opening hours, addresses and weather are for reference only and may change. Please confirm with the venue before you go. In rain, fog or bad mountain roads, put safety first.'}
      <div style={{ marginTop:8 }}>
        {vi ? 'Khẩn cấp: ' : 'Emergency: '}
        <a href="tel:113" style={{ color:'inherit', fontWeight:600 }}>113</a> {vi ? 'Công an' : 'Police'} · <a href="tel:114" style={{ color:'inherit', fontWeight:600 }}>114</a> {vi ? 'Cứu hỏa – cứu nạn' : 'Fire / rescue'} · <a href="tel:115" style={{ color:'inherit', fontWeight:600 }}>115</a> {vi ? 'Cấp cứu y tế' : 'Ambulance'}
      </div>
    </footer>
  )
}
