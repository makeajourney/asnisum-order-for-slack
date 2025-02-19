# asnisum-order-for-slack

## 메뉴 설정 가이드

아즈니섬 주문봇의 메뉴는 [`lib/menuConfig.js`](lib/menuConfig.js) 파일에서 관리됩니다. 이 파일은 메뉴 목록과 각종 옵션들을 정의합니다.

### 메뉴 구조

메뉴 설정은 다음과 같은 구조로 되어 있습니다:

```javascript
const menuConfig = {
  menus: [...],           // 메뉴 목록
  beanOptions: [...],     // 원두 옵션
  temperatureOptions: [...], // 온도 옵션
  extraOptions: [...],    // 추가 옵션
  categoriesNeedingBeanOption: [...] // 원두 옵션이 필요한 카테고리
};
```

### 메뉴 추가하기

새로운 메뉴를 추가하려면 `menus` 배열에 새로운 메뉴 객체를 추가합니다.

```javascript
{
  text: '메뉴명',    // 메뉴 표시명
  value: '메뉴값',   // 메뉴 식별자 (보통 메뉴명과 동일)
  category: '카테고리' // 메뉴 카테고리
}
```

#### 사용 가능한 카테고리
- `coffee`: 커피 메뉴 (원두 옵션 필요)
- `latte`: 라떼 류
- `tea`: 차 류
- `ade`: 에이드 류
- `bottle`: 병음료

### 옵션 설정

#### 원두 옵션 (`beanOptions`)
커피 메뉴에 적용되는 원두 선택 옵션입니다.
```javascript
{
  text: '원두명',  // 표시될 원두 이름
  value: '원두값'  // 원두 식별자
}
```

#### 온도 옵션 (`temperatureOptions`)
음료의 온도를 선택하는 옵션입니다.
```javascript
{
  text: '온도표시', // 'HOT' 또는 'ICE'
  value: '온도값'   // 'hot' 또는 'ice'
}
```

#### 추가 옵션 (`extraOptions`)
음료에 적용할 수 있는 추가 옵션입니다.
```javascript
{
  text: '옵션명',  // 표시될 옵션 이름
  value: '옵션값'  // 옵션 식별자
}
```

### 원두 옵션 필요 카테고리 설정

`categoriesNeedingBeanOption` 배열에 원두 선택이 필요한 카테고리를 지정합니다.
- 현재는 `['coffee']`로 설정되어 있어 커피 카테고리의 메뉴에만 원두 선택 옵션이 표시됩니다.

### 예시: 새 메뉴 추가하기

```javascript
// 새로운 커피 메뉴 추가
{
  text: '카페모카',
  value: '카페모카',
  category: 'coffee'  // 커피 메뉴이므로 원두 옵션 사용 가능
}

// 새로운 라떼 메뉴 추가
{
  text: '흑임자라떼',
  value: '흑임자라떼',
  category: 'latte'  // 라떼 메뉴
}
```

### 주의사항

1. 메뉴의 `text`와 `value`는 일반적으로 동일한 값을 사용합니다.
2. 카테고리는 위에서 언급된 다섯 가지 중 하나를 사용해야 합니다.
3. 새로운 카테고리를 추가하려면 코드의 다른 부분도 수정이 필요할 수 있습니다.
4. 원두 옵션이 필요한 메뉴는 반드시 `coffee` 카테고리로 지정해야 합니다.