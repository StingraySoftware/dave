fileSelectorCounter = 0;

function fileSelector(id, label, uploadFn, onFileChangedFn) {

  var currentObj = this;

  this.id = id;
  this.label = label;
  this.uploadFn = uploadFn;
  this.onFileChangedFn = onFileChangedFn;
  this.uploadInputId = 'upload_input' + fileSelectorCounter;
  fileSelectorCounter ++;

  this.$html = $('<div class="fileSelector ' + id + '">' +
                    '<form action="" method="POST" enctype="multipart/form-data">' +
                      '<h3>' + label + '</h3>' +
                      '<label class="fileBtn">' +
                        '<input id="' + this.uploadInputId + '" name="file" type="file" style="width:100%"/>' +
                      '</label>' +
                   '</form>' +
                 '</div>');

  this.$html.find("#" + currentObj.uploadInputId).on('change', function () {

     var file = this.files[0];
     var name = file.name;
     var size = file.size;
     var type = file.type;

     var fullfilename= this.value;
     var newFilename = fullfilename.replace(/^.*[\\\/]/, '');
     var formData = new FormData(currentObj.$html.find('form')[0]);

     currentObj.uploadFn(function (response) {
                                     var jsonRes = JSON.parse(response);
                                     if (jsonRes.error != undefined) {
                                       currentObj.onUploadError(jsonRes.error);
                                     } else {
                                       currentObj.onFileChangedFn(jsonRes.filename);
                                     };
                                 },
                         currentObj.onUploadError,
                         formData);
   });

   this.onUploadError = function ( error ) {
     if (error != undefined) {
       log("onUploadError:" + JSON.stringify(error));
       currentObj.$html.find("#" + currentObj.uploadInputId).val("");
     }
   }

   log ("new fileSelector id: " + id + ", label: " + label + ", inputId: " + this.uploadInputId);

   return this;
}
