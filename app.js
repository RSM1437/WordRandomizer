const blankCellColor = [255, 255, 255];
var fileText = "";
var pageNum = 1;

function genPDF() {
    var numColumns = document.getElementById('numColumnsOption').value;
    var wordTable = genWordTable(getWords(), numColumns);
    var doc = new jsPDF();
    var textColor = hexToRgb(document.getElementById('textColorOption').value);
    doc.autoTable({
        body: wordTable,
        didParseCell: function (data) {
            if(data.cell.raw != undefined) {
                data.cell.styles.fillColor = getCellColor(data.column.index);
            }
            else {
                data.cell.styles.fillColor = blankCellColor;
            }
            data.cell.styles.textColor = textColor;
        },
    });
    var outputFilenameBox = document.getElementById("outputFilename");
    var outputFilename = outputFilenameBox.value;
    if(outputFilename.length === 0) {
        outputFilename = outputFilenameBox.placeholder;
    }
    if(!outputFilename.endsWith(".pdf")) {
        outputFilename += ".pdf";
    }
    doc.save(outputFilename);
}

function getCellColor(colIndex) {
    var evenColumnColor = hexToRgb(document.getElementById('columnColor1').value);
    var oddColumnColor = hexToRgb(document.getElementById('columnColor2').value);
    return colIndex % 2 === 0 ? evenColumnColor : oddColumnColor;
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
      [parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)]
      : null;
  }

function genWordTable(words, numColumns) {
    var wordTable= [];
    var row = [];
    var colIndex = 0;
    for(var i = 0; i < words.length; i++) {
        row.push(words[i]);
        ++colIndex;
        if(colIndex == numColumns) {
            colIndex = 0;
            wordTable.push(row);
            row = [];
        }
    }
    if(row.length > 0) {
        wordTable.push(row);
    }
    return wordTable;
}

function getWords() {
    var words = [];
    if(document.getElementById("wordSourceText").checked) {
        words = getWordsFromText(document.getElementById('wordSourceTextarea').value);
    }
    else if (document.getElementById("wordSourceFile").checked) {
        words = getWordsFromText(fileText);
    }
    return words;
}

function getWordsFromText(text) {
    var words = [];
    var lines = text.split("\n");
    for(var i = 0; i < lines.length; ++i) {
        var wordsOnLine = lines[i].split(" ");
        for(var j = 0; j < wordsOnLine.length; ++j) {
            var word = wordsOnLine[j].trim().replace('\r', '');
            if(word.length > 0) {
                words.push(word);
            }
        }
    }
    return words;
}

function nextPage() {
    document.getElementById('page' + pageNum).style.display = "none";
    ++pageNum;
    document.getElementById('page' + pageNum).style.display = "block";
}

function prevPage() {
    document.getElementById('page' + pageNum).style.display = "none";
    --pageNum;
    document.getElementById('page' + pageNum).style.display = "block";
}

document.getElementById('wordSourceFileInput').addEventListener('change', function() {
    var fr = new FileReader();
    fr.onload = function() {
        fileText = fr.result;
    } 
    fr.readAsText(this.files[0]);
})