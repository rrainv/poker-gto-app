(function installPokerPrimitives(root) {
  'use strict';

  const AMOUNT_SIZES = Object.freeze({
    small: Object.freeze({ width: 76, height: 14, chipX: 10, chipY: 0, textX: 28, textY: 10 }),
    normal: Object.freeze({ width: 112, height: 20, chipX: 14, chipY: 1, textX: 37, textY: 14 }),
  });

  const TABLE_AMOUNT_SIZES = Object.freeze({
    small: Object.freeze({ stackTransform: 'translate(-37 -10) scale(1)', textX: -8, textY: 4 }),
    normal: Object.freeze({ stackTransform: 'translate(-50 -12) scale(1.2)', textX: -17, textY: 5 }),
  });

  function escapeMarkup(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function supportedSize(size) {
    return Object.prototype.hasOwnProperty.call(AMOUNT_SIZES, size) ? size : 'normal';
  }

  function pokerChipVisualSvg({ className = '', transform = '' } = {}) {
    const classes = `poker-chip-visual${className ? ` ${className}` : ''}`;
    const transformAttribute = transform ? ` transform="${escapeMarkup(transform)}"` : '';
    const edgeInsert = 'M6.55 1.1 L6.9 4.15 H9.1 L9.45 1.1 Z';
    return `
      <g class="${escapeMarkup(classes)}"${transformAttribute} aria-hidden="true">
        <circle class="poker-chip-body" cx="8" cy="8" r="6.8" />
        <g class="poker-chip-edge-inserts">
          ${Array.from({ length: 8 }, (_, index) => (
            `<path d="${edgeInsert}" transform="rotate(${index * 45} 8 8)" />`
          )).join('')}
        </g>
        <circle class="poker-chip-inner-ring" cx="8" cy="8" r="3.9" />
        <circle class="poker-chip-core" cx="8" cy="8" r="2.85" />
      </g>`;
  }

  function pokerChipGlyphSvg({ size = 'normal', x = 0, y = 0, className = '' } = {}) {
    const resolvedSize = supportedSize(size);
    const pixelSize = resolvedSize === 'small' ? 14 : 18;
    const classes = `poker-chip-glyph poker-chip-glyph--${resolvedSize}${className ? ` ${className}` : ''}`;
    return `
      <svg class="${escapeMarkup(classes)}" x="${escapeMarkup(x)}" y="${escapeMarkup(y)}" width="${pixelSize}" height="${pixelSize}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        ${pokerChipVisualSvg()}
      </svg>`;
  }

  function pokerChipStackSvg({ className = '', transform = '' } = {}) {
    const classes = `poker-chip-stack${className ? ` ${className}` : ''}`;
    const transformAttribute = transform ? ` transform="${escapeMarkup(transform)}"` : '';
    return `
      <g class="${escapeMarkup(classes)}"${transformAttribute} aria-hidden="true">
        ${pokerChipVisualSvg({ className: 'poker-chip-stack-back', transform: 'translate(0 3)' })}
        ${pokerChipVisualSvg({ className: 'poker-chip-stack-front', transform: 'translate(5 0)' })}
      </g>`;
  }

  function pokerAmountSvg({
    id = '',
    className = '',
    size = 'normal',
    x = 0,
    y = 0,
    prefix = '',
    value = '',
    unit = 'bb',
    ariaLabel = '',
    ariaHidden = false,
  } = {}) {
    const resolvedSize = supportedSize(size);
    const layout = AMOUNT_SIZES[resolvedSize];
    const classes = `poker-amount poker-amount--${resolvedSize}${className ? ` ${className}` : ''}`;
    const accessibility = ariaHidden
      ? ' aria-hidden="true"'
      : (ariaLabel ? ` role="group" aria-label="${escapeMarkup(ariaLabel)}"` : '');
    const idAttribute = id ? ` id="${escapeMarkup(id)}"` : '';
    const prefixText = prefix ? `${escapeMarkup(prefix)} ` : '';
    const unitText = unit ? ` ${escapeMarkup(unit)}` : '';

    return `
      <svg${idAttribute} class="${escapeMarkup(classes)}" data-poker-amount-size="${resolvedSize}" dir="ltr" x="${escapeMarkup(x)}" y="${escapeMarkup(y)}" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"${accessibility}>
        ${pokerChipGlyphSvg({ size: resolvedSize, x: layout.chipX, y: layout.chipY })}
        <text class="poker-amount-text" x="${layout.textX}" y="${layout.textY}" text-anchor="start"><tspan class="poker-amount-prefix">${prefixText}</tspan><tspan class="poker-amount-value">${escapeMarkup(value)}</tspan><tspan class="poker-amount-unit">${unitText}</tspan></text>
      </svg>`;
  }

  function pokerTableAmountSvg({
    id = '',
    className = '',
    size = 'small',
    x = 0,
    y = 0,
    prefix = '',
    value = '',
    unit = 'bb',
    ariaLabel = '',
    ariaHidden = false,
    hidden = false,
  } = {}) {
    const resolvedSize = supportedSize(size);
    const layout = TABLE_AMOUNT_SIZES[resolvedSize];
    const classes = `poker-table-amount poker-table-amount--${resolvedSize}${className ? ` ${className}` : ''}`;
    const accessibility = ariaHidden
      ? ' aria-hidden="true"'
      : (ariaLabel ? ` role="group" aria-label="${escapeMarkup(ariaLabel)}"` : '');
    const idAttribute = id ? ` id="${escapeMarkup(id)}"` : '';
    const hiddenAttribute = hidden ? ' hidden' : '';
    const prefixText = prefix ? `${escapeMarkup(prefix)} ` : '';
    const unitText = unit ? ` ${escapeMarkup(unit)}` : '';

    return `
      <g${idAttribute} class="${escapeMarkup(classes)}" data-poker-amount-size="${resolvedSize}" dir="ltr" transform="translate(${escapeMarkup(x)} ${escapeMarkup(y)})"${accessibility}${hiddenAttribute}>
        ${pokerChipStackSvg({ className: 'poker-table-amount-chip-stack', transform: layout.stackTransform })}
        <text class="poker-table-amount-text poker-amount-text" x="${layout.textX}" y="${layout.textY}" text-anchor="start"><tspan class="poker-amount-prefix">${prefixText}</tspan><tspan class="poker-amount-value">${escapeMarkup(value)}</tspan><tspan class="poker-amount-unit">${unitText}</tspan></text>
      </g>`;
  }

  function setPokerAmount(element, {
    prefix = '', value = '', unit = 'bb', ariaLabel = '', ariaHidden = false,
  } = {}) {
    if (!element) return;
    const prefixElement = element.querySelector('.poker-amount-prefix');
    const valueElement = element.querySelector('.poker-amount-value');
    const unitElement = element.querySelector('.poker-amount-unit');
    if (prefixElement) prefixElement.textContent = prefix ? `${prefix} ` : '';
    if (valueElement) valueElement.textContent = String(value ?? '');
    if (unitElement) unitElement.textContent = unit ? ` ${unit}` : '';
    element.toggleAttribute('aria-hidden', ariaHidden);
    if (ariaHidden || !ariaLabel) {
      element.removeAttribute('role');
      element.removeAttribute('aria-label');
    } else {
      element.setAttribute('role', 'group');
      element.setAttribute('aria-label', ariaLabel);
    }
  }

  root.RiverlinePokerPrimitives = Object.freeze({
    sizes: AMOUNT_SIZES,
    pokerChipVisualSvg,
    pokerChipGlyphSvg,
    pokerChipStackSvg,
    pokerAmountSvg,
    pokerTableAmountSvg,
    setPokerAmount,
  });
}(globalThis));
