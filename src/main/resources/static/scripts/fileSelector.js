
function fileSelector(id, filename, uploadFn, onFileChangedFn) {

  var currentObj = this;

  this.id = id;
  this.uploadFn = uploadFn;
  this.onFileChangedFn = onFileChangedFn;

  this.$html = $('<div class="fileSelector ' + id + '">' +
                    '<form action="" method="POST" enctype="multipart/form-data">' +
                      '<h3>Filename</h3>' +
                      '<label class="fileBtn">' +
                        '<input id="upload_input" name="file" type="file"/>' +
                      '</label>' +
                   '</form>' +
                 '</div>');

  this.$html.find("#upload_input").on('change', function () {

     var file = this.files[0];
     var name = file.name;
     var size = file.size;
     var type = file.type;

     var fullfilename= this.value;
     var newFilename = fullfilename.replace(/^.*[\\\/]/, '');

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
       currentObj.$html.find("#upload_input").val("");
     }
   }

   log ("new fileSelector id: " + id + ", filename: " + filename)

   return this;
}
