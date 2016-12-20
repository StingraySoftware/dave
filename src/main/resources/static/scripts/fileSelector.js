
function fileSelector(id, fileName) {

  this.id = id;
  this.fileName = fileName;
  this.$html = $('<div class="fileSelector ' + id + '">' +
                   '<h3>Filename</h3>' +
                   '<input id="uploadFile" placeholder="Choose File" type="text" value="' + fileName + '" name="display_text" disabled="disabled" />' +
                   '<label class="myLabel">' +
                      '<input id="upload_input" name="file" type="file"/>' +
                   '</label>' +
                 '</div>');

   this.$html.on('change','input[type="file"]', function () {
     var fullfilename= this.value;
     var newFilename = fullfilename.replace(/^.*[\\\/]/, '');
     $("#uploadFile").value = newFilename;
   });

   log ("new fileSelector id: " + id + ", filename: " + filename)

   return this;
}
