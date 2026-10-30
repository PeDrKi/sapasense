// Nội dung hướng dẫn tổng hợp từ nguồn công khai (không phải dữ liệu địa điểm). Mỗi mục ghi nguồn; hãy kiểm tra lại lịch lễ hội với ban tổ chức trước khi đi.
export interface Specialty { name: string; vi: string; en: string }
export interface Festival { name: string; en: string; when: string; whenEn: string; where: string; vi: string; en2: string; src: string }
export const GUIDE_CHECKED = '10/2026'

export const SPECIALTIES: Specialty[] = [
  { name:'Thịt lợn cắp nách', vi:'Lợn đen thả rông, thịt chắc, da giòn; thường nướng hoặc quay với lá rừng.', en:'Free-range black pork with crisp skin, grilled or roasted with wild herbs.' },
  { name:'Thịt trâu gác bếp', vi:'Thịt trâu sấy khô trên gác bếp, vị đậm và thơm khói.', en:'Buffalo meat smoke-dried over the kitchen hearth; rich and smoky.' },
  { name:'Cá hồi, cá tầm', vi:'Cá nước lạnh nuôi ở vùng núi; ăn gỏi, chiên hoặc lẩu.', en:'Cold-water farmed salmon and sturgeon: raw salad, fried or hotpot.' },
  { name:'Cơm lam ống tre', vi:'Gạo nếp nấu trong ống tre, dẻo thơm; chấm muối vừng.', en:'Sticky rice cooked in bamboo tubes, eaten with sesame salt.' },
  { name:'Thịt lợn chua', vi:'Thịt lợn đen ủ cùng rau rừng và gia vị, ăn kèm lá lốt.', en:'Black pork fermented with wild greens and spices, served with betel leaves.' },
  { name:'Cốn sủi', vi:'Món nước giống phở, nước dùng đậm, ăn kèm trứng, thịt lợn hoặc bò.', en:'A phở-like noodle soup with a thick aromatic broth.' },
  { name:'Bánh hạt dẻ', vi:'Bánh tròn mềm, nhân hạt dẻ xay thơm vừng và dầu dừa.', en:'Soft round cake filled with ground chestnut, sesame and coconut oil.' },
  { name:'Rượu táo mèo', vi:'Rượu gạo ngâm táo mèo, màu vàng, vị chua ngọt.', en:'Rice wine steeped with mèo apples; golden, sweet-sour.' },
]
export const SPECIALTIES_SRC = 'https://baolaocai.vn/8-mon-dac-san-sa-pa-nhac-den-la-them-post367434.html'

export const FESTIVALS: Festival[] = [
  { name:'Lễ hội Hoa đỗ quyên', en:'Rhododendron Festival', when:'Thường từ cuối tháng 3 đến đầu tháng 5 (lịch từng năm khác nhau)', whenEn:'Usually late March to early May (dates vary each year)', where:'Quanh khu du lịch Fansipan Legend',
    vi:'Ngắm đỗ quyên, nhạc cụ dân tộc (khèn, sáo), trò chơi dân gian vùng cao và ẩm thực Tây Bắc.', en2:'Rhododendron blooms, ethnic music (khèn, flutes), highland folk games and Northwest food.', src:'https://www.vietnambooking.com/du-lich/blog-du-lich/le-hoi-hoa-do-quyen-sap-dien-ra-tai-sa-pa-lao-cai.html' },
  { name:'Lễ hội mùa hè Sa Pa', en:'Sa Pa Summer Festival', when:'Khai mạc cuối tháng 4, kéo dài khoảng hai tháng (theo bản 2018, có thể đã đổi)', whenEn:'Opens late April, runs about two months (per the 2018 edition; may have changed)', where:'Trung tâm thị trấn Sa Pa',
    vi:'Lễ hội đường phố, tái hiện đời sống các dân tộc, "Chợ vùng cao", văn nghệ và thể thao dân tộc.', en2:'Street festival, ethnic life re-enactments, a highland market, performances and traditional sports.', src:'https://thuonghieucongluan.com.vn/top-ba-le-hoi-hot-nhat-vinh-bac-bo-he-2018-a50168.html' },
  { name:'Ngày hội văn hóa bản Mông Cát Cát', en:'Cát Cát H’Mông Culture Days', when:'Khoảng cuối tháng 4 đến đầu tháng 5 (theo bản 2018)', whenEn:'Around late April to early May (per 2018)', where:'Bản Cát Cát',
    vi:'Trò chơi dân gian và nghề thủ công: rèn, chạm bạc, dệt vải, nhuộm chàm, vẽ sáp ong.', en2:'Folk games and crafts: forging, silver engraving, weaving, indigo dyeing, beeswax batik.', src:'https://thuonghieucongluan.com.vn/top-ba-le-hoi-hot-nhat-vinh-bac-bo-he-2018-a50168.html' },
]
