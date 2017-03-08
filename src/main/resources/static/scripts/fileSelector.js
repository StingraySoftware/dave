fileSelectorCounter = 0;

function fileSelector(id, label, selectorKey, uploadFn, onFileChangedFn) {

  var currentObj = this;

  this.id = id;
  this.label = label;
  this.selectorKey = selectorKey;
  this.uploadFn = uploadFn;
  this.onFileChangedFn = onFileChangedFn;
  this.uploadInputId = 'upload_input' + fileSelectorCounter;
  fileSelectorCounter ++;

  this.$html = $('<div class="fileSelector ' + id + '">' +
                    '<form action="" method="POST" enctype="multipart/form-data">' +
                      '<h3>' + label + '</h3>' +
                      '<label class="fileBtn">' +
                        '<input id="' + this.uploadInputId + '" name="file" type="file" style="width:100%" multiple/>' +
                      '</label>' +
                   '</form>' +
                 '</div>');

  this.$html.find("#" + currentObj.uploadInputId).on('change', function () {

      if (this.files.length > 0) {
       if (this.files.length == 1) {

         //Normal file upload!
         var fullfilename= this.value;
         var newFilename = fullfilename.replace(/^.*[\\\/]/, '');
         waitingDialog.show('Uploading file: ' + newFilename);

       } else if (this.files.length > 1) {

         waitingDialog.show('Uploading files...');
       }

       var formData = new FormData(currentObj.$html.find('form')[0]);
       currentObj.uploadFn(function (response) {
                                       var jsonRes = JSON.parse(response);
                                       if (jsonRes.error != undefined) {
                                         currentObj.onUploadError(jsonRes.error);
                                       } else {
                                         currentObj.onFileChangedFn(jsonRes, currentObj.selectorKey);
                                       };
                                   },
                           currentObj.onUploadError,
                           formData);
     }
   });

   this.onUploadError = function ( error ) {
     if (error != undefined) {
       waitingDialog.hide();
       log("onUploadError:" + JSON.stringify(error));
       currentObj.$html.find("#" + currentObj.uploadInputId).val("");
     }
   }

   this.show = function () {
     this.$html.show();
   }

   this.hide = function () {
     this.$html.hide();
   }

   log ("new fileSelector id: " + id + ", label: " + label + ", inputId: " + this.uploadInputId);

   return this;
}
