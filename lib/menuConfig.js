const menuConfig = {
  // 메뉴 목록
  menus: [
    {
      text: '아메리카노',
      value: '아메리카노',
      category: 'coffee', // 원두 옵션이 필요한 커피 메뉴
      availableForLunch: true, // 점심시간 주문 가능
    },
    {
      text: '쑥라떼',
      value: '쑥라떼',
      category: 'latte',
      availableForLunch: true, // 점심시간 주문 가능
    },
    {
      text: '카페라떼',
      value: '카페라떼',
      category: 'coffee',
      availableForLunch: true, // 점심시간 주문 가능
    },
    {
      text: '바닐라빈라떼',
      value: '바닐라빈라떼',
      category: 'coffee',
      availableForLunch: true, // 점심시간 주문 가능
    },
    {
      text: '콜드브루',
      value: '콜드브루',
      category: 'coffee',
      availableForLunch: false, // 점심시간 주문 불가능 (메뉴판에 없음)
    },
    {
      text: '아이스티',
      value: '아이스티',
      category: 'tea',
      availableForLunch: true, // 점심시간 주문 가능
    },
    {
      text: '말차라떼',
      value: '말차라떼',
      category: 'latte',
      availableForLunch: false, // 점심시간 주문 불가능 (메뉴판에 없음)
    },
    {
      text: '밀크티',
      value: '밀크티',
      category: 'tea',
      availableForLunch: true, // 점심시간 주문 가능
    },
    {
      text: '쇼콜라라떼',
      value: '쇼콜라라떼',
      category: 'latte',
      availableForLunch: true, // 점심시간 주문 가능 (Chocolate Latte로 메뉴판에 있음)
    },
    {
      text: '자몽에이드',
      value: '자몽에이드',
      category: 'ade',
      availableForLunch: false, // 점심시간 주문 불가능 (메뉴판에 없음)
    },
    {
      text: '레몬에이드',
      value: '레몬에이드',
      category: 'ade',
      availableForLunch: false, // 점심시간 주문 불가능 (메뉴판에 없음)
    },
    {
      text: '호지차',
      value: '호지차',
      category: 'tea',
      availableForLunch: true, // 점심시간 주문 가능 (Roasted Green Tea로 메뉴판에 있음)
    },
    {
      text: '잭살차',
      value: '잭살차',
      category: 'tea',
      availableForLunch: true, // 점심시간 주문 가능 (Jacksal Tea로 메뉴판에 있음)
    },
    {
      text: '호박차',
      value: '호박차',
      category: 'tea',
      availableForLunch: true, // 점심시간 주문 가능 (Pumpkin Tea로 메뉴판에 있음)
    },
    {
      text: '분다버그 진저비어',
      value: '분다버그 진저비어',
      category: 'bottle',
      availableForLunch: true, // 점심시간 주문 가능 (Bundaberg로 메뉴판에 있음)
    },
    {
      text: '분다버그 레몬',
      value: '분다버그 레몬',
      category: 'bottle',
      availableForLunch: true, // 점심시간 주문 가능 (Bundaberg로 메뉴판에 있음)
    },
    {
      text: '분다버그 자몽',
      value: '분다버그 자몽',
      category: 'bottle',
      availableForLunch: true, // 점심시간 주문 가능 (Bundaberg로 메뉴판에 있음)
    },
    {
      text: '애플주스',
      value: '애플주스',
      category: 'bottle',
      availableForLunch: true, // 점심시간 주문 가능
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

  // 점심시간 여부를 확인하는 함수
  isLunchTime: () => {
    const now = new Date();
    const hours = now.getHours();
    // 12:00 ~ 14:00를 점심시간으로 설정
    return hours >= 12 && hours < 14;
  },

  // 현재 주문 가능한 메뉴만 필터링하는 함수
  getAvailableMenus: (checkLunchTime = true) => {
    // 점심시간인지 확인
    const isLunch = checkLunchTime && menuConfig.isLunchTime();

    // 점심시간이면 availableForLunch가 true인 메뉴만 반환, 아니면 모든 메뉴 반환
    return menuConfig.menus.filter(
      (menu) => !isLunch || menu.availableForLunch
    );
  },
};

module.exports = menuConfig;
