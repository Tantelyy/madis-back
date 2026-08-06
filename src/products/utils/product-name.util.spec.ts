import { composeProductName, extractProductType } from './product-name.util';

describe('product name utilities', () => {
  it('composes names using type, specification, mark, format order', () => {
    expect(
      composeProductName({
        type: 'Lait',
        specification: 'Croissance',
        mark: 'FRANCE LAIT',
        format: '900g',
      }),
    ).toBe('Lait Croissance FRANCE LAIT 900g');
  });

  it('extracts the product type despite casing and extra spaces', () => {
    expect(
      extractProductType('  Couches TWIN MINI PIKABOO 40pc ', {
        mark: 'pikaboo',
        specification: 'TWIN MINI',
        format: '40pc',
      }),
    ).toBe('Couches');
  });

  it('keeps TWIN in the type when only MINI is the specification', () => {
    expect(
      extractProductType('Couches TWIN MINI PIKABOO 40pc', {
        mark: 'PIKABOO',
        specification: 'MINI',
        format: '40pc',
      }),
    ).toBe('Couches TWIN');
  });

  it('removes a multi-word specification from the product label', () => {
    expect(
      extractProductType('Couches BLEU MAXI MOLLY 32PC', {
        mark: 'MOLLY',
        specification: 'BLEU MAXI',
        format: '32pc',
      }),
    ).toBe('Couches');
  });

  it('does not remove a component from inside a longer word', () => {
    expect(
      extractProductType('Lait APTAMIL 1ER AGE 900g', {
        mark: 'APTAMIL',
        specification: 'Aptamil 1',
        format: '900g',
      }),
    ).toBe('Lait 1ER AGE');
  });
});
