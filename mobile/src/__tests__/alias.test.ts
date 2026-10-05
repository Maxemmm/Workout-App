import { APP_NAME } from '@/config';

describe('alias @/', () => {
  it('résout les imports depuis src/', () => {
    expect(APP_NAME).toBe('WORKOUT');
  });
});
