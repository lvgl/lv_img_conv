import { round_half_up } from '../lib/helpers';

test('round_half_up should round -0.5 to -1', () => {
    expect(round_half_up(-0.5)).toEqual(-1);
})

test('round_half_up should round -1.5 to -2', () => {
    expect(round_half_up(-1.5)).toEqual(-2);
})