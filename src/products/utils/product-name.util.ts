export interface ProductNameParts {
  type: string;
  specification: string;
  mark: string;
  format: string;
}

export interface ProductLabelParts {
  mark: string;
  specification: string;
  format: string;
}

export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

export function normalizeNameKey(value: string): string {
  return normalizeWhitespace(value).toLocaleLowerCase('fr');
}

export function composeProductName(parts: ProductNameParts): string {
  return [parts.type, parts.specification, parts.mark, parts.format]
    .map(normalizeWhitespace)
    .filter(Boolean)
    .join(' ');
}

export function extractProductType(
  label: string,
  parts: ProductLabelParts,
): string {
  const normalizedLabel = normalizeWhitespace(label);
  const components = [parts.specification, parts.mark, parts.format]
    .map(normalizeWhitespace)
    .filter(Boolean)
    .sort((first, second) => second.length - first.length);
  let remainingLabel = normalizedLabel;

  for (const component of components) {
    const componentIndex = findWholeComponentIndex(remainingLabel, component);

    if (componentIndex >= 0) {
      remainingLabel = normalizeWhitespace(
        `${remainingLabel.slice(0, componentIndex)} ${remainingLabel.slice(
          componentIndex + component.length,
        )}`,
      );
    }
  }

  return remainingLabel;
}

function findWholeComponentIndex(value: string, component: string): number {
  const valueKey = normalizeNameKey(value);
  const componentKey = normalizeNameKey(component);
  let searchFrom = 0;

  while (searchFrom <= valueKey.length - componentKey.length) {
    const index = valueKey.indexOf(componentKey, searchFrom);

    if (index < 0) {
      return -1;
    }

    const beforeComponent = valueKey[index - 1];
    const afterComponent = valueKey[index + componentKey.length];
    const startsOnBoundary =
      beforeComponent === undefined || beforeComponent === ' ';
    const endsOnBoundary =
      afterComponent === undefined || afterComponent === ' ';

    if (startsOnBoundary && endsOnBoundary) {
      return index;
    }

    searchFrom = index + 1;
  }

  return -1;
}
