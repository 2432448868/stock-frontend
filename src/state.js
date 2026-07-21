// 全局共享状态
export const state = {
  // 大盘走势
  chart: null,
  echartsReady: false,
  selectedIdx: 0,
  currentKlt: '101',
  klineCache: {},
  // 板块分析
  sectorData: {},
  currentSectorType: 'industry',
  sortColumn: 'rank',
  sortDir: 'asc',
  searchQuery: '',
  // 资金流向
  currentCapitalType: 'industry',
  // 自动刷新
  countdown: 1800,
};
