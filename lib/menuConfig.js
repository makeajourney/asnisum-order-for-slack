const menuConfig = {
  // 메뉴 목록
  menus: [
    {
      text: '아메리카노',
      value: '아메리카노',
      category: 'coffee', // 원두 옵션이 필요한 커피 메뉴
    },
    {
      text: '쑥라떼',
      value: '쑥라떼',
      category: 'latte',
    },
    {
      text: '카페라떼',
      value: '카페라떼',
      category: 'coffee',
    },
    {
      text: '바닐라빈라떼',
      value: '바닐라빈라떼',
      category: 'coffee',
    },
    {
      text: '아이스티',
      value: '아이스티',
      category: 'tea',
    },
    {
      text: '말차라떼',
      value: '말차라떼',
      category: 'latte',
    },
    {
      text: '밀크티',
      value: '밀크티',
      category: 'tea',
    },
    {
      text: '쇼콜라라떼',
      value: '쇼콜라라떼',
      category: 'latte',
    },
    {
      text: '자몽에이드',
      value: '자몽에이드',
      category: 'ade',
    },
    {
      text: '몬트리올',
      value: '몬트리올',
      category: 'tea',
    },
    {
      text: '버베인 멘테',
      value: '버베인 멘테',
      category: 'tea',
    },
    {
      text: '분다버그 진저비어',
      value: '분다버그 진저비어',
      category: 'bottle',
    },
    {
      text: '분다버그 레몬',
      value: '분다버그 레몬',
      category: 'bottle',
    },
    {
      text: '분다버그 자몽',
      value: '분다버그 자몽',
      category: 'bottle',
    },
    {
      text: '애플주스',
      value: '애플주스',
      category: 'bottle',
    },
  ],

  // 원두 옵션
  beanOptions: [
    {
      text: '다크(기본)',
      value: 'dark',
    },
    {
      text: '산미',
      value: 'acid',
    },
    {
      text: '디카페인',
      value: 'decaf',
    },
  ],

  // 온도 옵션
  temperatureOptions: [
    {
      text: 'HOT',
      value: 'hot',
    },
    {
      text: 'ICE',
      value: 'ice',
    },
  ],

  // 추가 옵션
  extraOptions: [
    {
      text: '샷 추가',
      value: 'extra_shot',
    },
    {
      text: '연하게',
      value: 'light',
    },
    {
      text: '덜 달게',
      value: 'less_sweet',
    },
    {
      text: '얼음 적게',
      value: 'less_ice',
    },
  ],

  // 원두 옵션이 필요한 카테고리
  categoriesNeedingBeanOption: ['coffee'],
};

module.exports = menuConfig;
