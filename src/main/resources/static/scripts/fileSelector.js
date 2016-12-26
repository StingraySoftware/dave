
function fileSelector(id, fileName) {

  var currentObj = this;

  this.id = id;
  this.fileName = fileName;
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

     var formData = new FormData($('form')[0]);
     $.ajax({
        url: DOMAIN_URL + "/upload",  //Server script to process data
        type: 'POST',
        /*xhr: function() {  // Custom XMLHttpRequest
            var myXhr = $.ajaxSettings.xhr();
            if(myXhr.upload){ // Check if upload property exists
                myXhr.upload.addEventListener('progress', function (progress) { log("progress:" + progress) }, false); // For handling the progress of the upload
            }
            return myXhr;
        },*/
        //Ajax events
        beforeSend: function () { log("beforeSend") },
        success: function (response) {
                                        var jsonRes = JSON.parse(response);
                                        if (jsonRes.error != undefined) {
                                          currentObj.onUploadError(jsonRes.error);
                                        } else {
                                          onDatasetChanged(jsonRes.filename);
                                        }
                                    },
        error: currentObj.onUploadError(),
        // Form data
        data: formData,
        //Options to tell jQuery not to process data or worry about content-type.
        cache: false,
        contentType: false,
        processData: false
    });
   });

   this.onUploadError = function ( error ) {
     if (error != undefined) {
       log("onUploadError:" + JSON.stringify(error));
       this.$inputFile.value = "";
     }
   }

   log ("new fileSelector id: " + id + ", filename: " + filename)

   return this;
}
