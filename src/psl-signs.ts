import type { ImageSourcePropType } from 'react-native';
import catalog from '../shared/psl-sign-catalog.json';

const symbols: Record<string, ImageSourcePropType> = {
  best: require('../assets/psl-signs/best.jpg'),
  fail: require('../assets/psl-signs/fail.jpg'),
  free: require('../assets/psl-signs/free.jpg'),
  hi: require('../assets/psl-signs/hi.jpg'),
  home: require('../assets/psl-signs/home.jpg'),
  meet: require('../assets/psl-signs/meet.jpg'),
  sorry: require('../assets/psl-signs/sorry.jpg'),
  thanks: require('../assets/psl-signs/thanks.jpg'),
  wait: require('../assets/psl-signs/wait.jpg'),
  welcome: require('../assets/psl-signs/welcome.jpg'),
};

export const pslSigns = catalog.map(sign => ({ ...sign, symbol: symbols[sign.id] }));
