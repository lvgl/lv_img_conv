import { Converter } from '../lib/convert';
import { ImageMode } from '../lib/enums';

test('CF_RAW_CHROMA should produce LV_COLOR_FORMAT_RAW', () => {
    expect(Converter.imagemode_to_enum_name(ImageMode.CF_RAW_CHROMA)).toEqual("LV_COLOR_FORMAT_RAW");
})