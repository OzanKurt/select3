// jsdom lacks layout APIs our code calls.
if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView() {};
}
// jsdom does not implement hit-testing; provide a stub specs can spy on.
if (!document.elementFromPoint) {
    document.elementFromPoint = () => null;
}
