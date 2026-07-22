// 全局共享状态
export const state = {
  // 大盘走势
  chart: null,
  echartsReady: false,
  selectedIdx: 0,
  currentKlt: '101',
  klineCache: {},
  klineTime: '',
  // 板块分析
  sectorData: {},
  sectorTime: '',
  currentSectorType: 'industry',
  sortColumn: 'rank',
  sortDir: 'asc',
  searchQuery: '',
  // 资金流向
  currentCapitalType: 'industry',
  capitalTime: '',
  // 自动刷新
  countdown: 1800,
};
