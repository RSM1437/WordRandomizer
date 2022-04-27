var Filter = require('bad-words');

window.isBadWord = function(word) {
    return (new Filter()).isProfane(word);
}