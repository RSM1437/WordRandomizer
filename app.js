function genPDF() {
    var doc = new jsPDF();
    doc.text(20, 20, "Hello!");
    doc.save("Test.pdf");
}
