
function Service (base_url) {

  var thisService = this;

  this.base_url = base_url;

  this.upload_form_data = function (successFn, errorFn) {
    var formData = new FormData($('form')[0]);
    $.ajax({
       url: thisService.base_url + "/upload",
       type: 'POST',
       //Ajax events
       success: successFn,
       error: errorFn,
       // Form data
       data: formData,
       //Options to tell jQuery not to process data or worry about content-type.
       cache: false,
       contentType: false,
       processData: false
     });
   };

  this.get_dataset_schema  = function ( filename, fn, errorFn ) {
    $.get( thisService.base_url + "/get_dataset_schema", { filename: filename } ).done(fn).fail(errorFn);
  };

  this.request_plot_data = function (plot_data, fn) {
    log("request_plot_data plot " + JSON.stringify(plot_data));
    $.ajax({
       type : "POST",
       url : thisService.base_url + "/get_plot_data",
       data: JSON.stringify(plot_data, null, '\t'),
       contentType: 'application/json;charset=UTF-8',
       success: fn
    });
  };

  this.request_lightcurve = function (lc_data, fn) {
    log("request_lightcurve plot " + JSON.stringify(lc_data));
    $.ajax({
       type : "POST",
       url : thisService.base_url + "/get_ligthcurve",
       data: JSON.stringify(lc_data, null, '\t'),
       contentType: 'application/json;charset=UTF-8',
       success: fn
    });
  };

  log("Service ready!");
}
