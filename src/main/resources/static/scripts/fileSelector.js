
function fileSelector(id, fileName, uploadFn, onFileChangedFn) {

  var currentObj = this;

  this.id = id;
  this.fileName = fileName;
  this.uploadFn = uploadFn;
  this.onFileChangedFn = onFileChangedFn;

  this.$html = $('<div class="fileSelector ' + id + '">' +
                   '<h3>Filename</h3>' +
                   '<input id="uploadFile" placeholder="Choose File" type="text" value="' + fileName + '" name="display_text" disabled="disabled" />' +
                   '<label class="fileBtn">' +
                      '<input id="upload_input" name="file" type="file"/>' +
                   '</label>' +
                 '</div>');

  this.$inputFile = this.$html.find("#uploadFile");
  this.$html.find("#upload_input").on('change', function () {

     var file = this.files[0];
     var name = file.name;
     var size = file.size;
     var type = file.type;

     var fullfilename= this.value;
     var newFilename = fullfilename.replace(/^.*[\\\/]/, '');
     currentObj.$inputFile.value = newFilename;
     
     currentObj.uploadFn(function (response) {
                                     var jsonRes = JSON.parse(response);
                                     if (jsonRes.error != undefined) {
                                       currentObj.onUploadError(jsonRes.error);
                                     } else {
                                       currentObj.onFileChangedFn(jsonRes.filename);
                                     };
                                 },
                         currentObj.onUploadError);
   });

   this.onUploadError = function ( error ) {
     if (error != undefined) {
       log("onUploadError:" + JSON.stringify(error));
       currentObj.$inputFile.value = "";
     }
   }

   log ("new fileSelector id: " + id + ", filename: " + filename)

   return this;
}
