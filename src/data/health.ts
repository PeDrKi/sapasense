/** Dị ứng thực phẩm phổ biến. Khớp theo từ khoá trong mô tả/thực đơn: chỉ là cảnh báo tham khảo, không thay lời hỏi nhân viên. */
export const ALLERGENS: Record<string, { label: string; labelEn: string; re: RegExp }> = {
  seafood: { label: 'Hải sản / cá',  labelEn: 'Seafood / fish', re: /hải sản|\bcá\b|cá hồi|cá tầm|tôm|cua|mực|ốc|salmon|trout|sturgeon|shrimp|seafood|fish/i },
  peanut:  { label: 'Đậu phộng / lạc', labelEn: 'Peanuts',      re: /đậu phộng|\blạc\b|peanut/i },
  dairy:   { label: 'Sữa / phô mai', labelEn: 'Dairy',          re: /sữa|phô mai|bơ sữa|kem\b|cheese|milk|cream|latte|cappuccino/i },
  gluten:  { label: 'Gluten (lúa mì)', labelEn: 'Gluten',       re: /lúa mì|bánh mì|\bmì\b|bánh ngọt|pizza|pasta|bread|noodle|wheat/i },
  egg:     { label: 'Trứng',          labelEn: 'Eggs',          re: /trứng|egg/i },
}

type TextPlace = { name: string; desc: string; tip?: string; badges?: string[]; menu?: { n: string }[] | null }

/** Allergens (from the user's list) that this place's text suggests may be present. */
export function allergyHits(p: TextPlace, allergies: string[] | undefined): string[] {
  if (!allergies?.length) return []
  const text = [p.name, p.desc, p.tip, ...(p.badges || []), ...((p.menu || []).map(m => m.n || ''))].join(' | ')
  return allergies.filter(a => ALLERGENS[a]?.re.test(text))
}
