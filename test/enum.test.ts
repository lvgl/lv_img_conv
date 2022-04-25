import { Converter } from '../lib/convert';
import { ImageMode } from '../lib/enums';

test('CF_RAW_CHROMA should produce LV_IMG_CF_RAW_CHROMA_KEYED', () => {
    expect(Converter.imagemode_to_enum_name(ImageMode.CF_RAW_CHROMA)).toEqual("LV_IMG_CF_RAW_CHROMA_KEYED");
})