export function setRunwayButtonContent(button, label) {
  button.replaceChildren(createLogoMark(), createLabel(label))
}

function createLabel(label) {
  const span = document.createElement('span')
  span.className = 'runway-btn__label'
  span.textContent = label
  return span
}

function createLogoMark() {
  const mark = document.createElement('span')
  mark.className = 'runway-btn__mark'

  for (const className of [
    'runway-btn__runway runway-btn__runway--a',
    'runway-btn__runway runway-btn__runway--b',
    'runway-btn__plane runway-btn__plane--body',
    'runway-btn__plane runway-btn__plane--wing',
    'runway-btn__plane runway-btn__plane--tail',
  ]) {
    const span = document.createElement('span')
    span.className = className
    mark.appendChild(span)
  }

  return mark
}
