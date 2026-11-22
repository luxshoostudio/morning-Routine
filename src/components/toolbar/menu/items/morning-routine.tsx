import { MdWbSunny } from 'react-icons/md/index';

import { Item } from '../item';

export function MorningRoutine() {
  return (
    <Item
      external={false}
      href="/routine"
      icon={<MdWbSunny />}
      label="Morning Routine"
    />
  );
}
