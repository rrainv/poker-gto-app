// AnalysisExplanation is structured application data. This file is the thin,
// presentation-only renderer shared by Playbook and Training.

function analysisUiText(value) {
  const copy = String(value || '');
  return typeof t === 'function' ? t(copy) : copy;
}

function analysisElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = analysisUiText(text);
  return element;
}

function renderAnalysisExplanation(container, explanation, options = {}) {
  if (!container) return null;
  container.replaceChildren();

  if (!explanation || explanation.schemaVersion !== 'analysis-explanation/v1') {
    const empty = analysisElement(
      'p',
      'analysis-explanation-empty',
      options.emptyMessage || 'Decision analysis is unavailable.',
    );
    container.appendChild(empty);
    container.dataset.analysisAvailability = 'unavailable';
    return empty;
  }

  const article = analysisElement('article', 'analysis-explanation');
  article.dataset.analysisDepth = explanation.depth;
  article.dataset.analysisAvailability = explanation.availability;

  const header = analysisElement('header', 'analysis-explanation-header');
  header.append(
    analysisElement('h3', 'analysis-explanation-headline', explanation.headline),
    analysisElement('p', 'analysis-explanation-summary', explanation.summary),
  );
  article.appendChild(header);

  const body = analysisElement('div', 'analysis-explanation-sections');
  explanation.sections.forEach((analysisSection) => {
    const sectionElement = analysisElement('section', 'analysis-explanation-section');
    sectionElement.dataset.analysisSection = analysisSection.key;
    sectionElement.dataset.importance = analysisSection.importance;
    sectionElement.appendChild(analysisElement('h4', 'analysis-explanation-section-title', analysisSection.title));

    if (analysisSection.facts.length) {
      const facts = analysisElement('dl', 'analysis-explanation-facts');
      analysisSection.facts.forEach((analysisFact) => {
        const row = analysisElement('div', 'analysis-explanation-fact');
        row.dataset.factKind = analysisFact.kind;
        const label = analysisElement('dt', null, analysisFact.label);
        const value = analysisElement('dd', null, analysisFact.text);
        row.append(label, value);
        facts.appendChild(row);
      });
      sectionElement.appendChild(facts);
    }

    analysisSection.textParts.forEach((part) => {
      const paragraph = analysisElement('p', 'analysis-explanation-text', part.text);
      paragraph.dataset.textKind = part.kind;
      sectionElement.appendChild(paragraph);
    });
    body.appendChild(sectionElement);
  });
  if (explanation.sections.length) article.appendChild(body);

  const footer = analysisElement('footer', 'analysis-explanation-footer');
  const source = analysisElement('div', 'analysis-explanation-source');
  source.append(
    analysisElement('span', null, 'Source'),
    analysisElement('strong', null, explanation.provenance.label),
  );
  if (explanation.provenance.modelVersion) {
    source.appendChild(analysisElement('small', null, `Model ${explanation.provenance.modelVersion}`));
  }
  if (Number.isFinite(explanation.provenance.confidence)) {
    source.appendChild(analysisElement('small', null, `Confidence ${(explanation.provenance.confidence * 100).toFixed(0)}%`));
  }
  if (Number.isFinite(explanation.provenance.coverage)) {
    source.appendChild(analysisElement('small', null, `Coverage ${(explanation.provenance.coverage * 100).toFixed(0)}%`));
  }
  footer.appendChild(source);

  if (explanation.warnings.length) {
    const limitations = analysisElement('details', 'analysis-explanation-limitations');
    const summary = analysisElement('summary', null, `Limits & caveats (${explanation.warnings.length})`);
    const list = analysisElement('ul', null);
    explanation.warnings.forEach((entry) => {
      const item = analysisElement('li', null, entry.message);
      item.dataset.warningCode = entry.code;
      item.dataset.warningSeverity = entry.severity;
      list.appendChild(item);
    });
    limitations.append(summary, list);
    footer.appendChild(limitations);
  }
  article.appendChild(footer);
  container.appendChild(article);
  container.dataset.analysisAvailability = explanation.availability;
  return article;
}

window.renderAnalysisExplanation = renderAnalysisExplanation;
