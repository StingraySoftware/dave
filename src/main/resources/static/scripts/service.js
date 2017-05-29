
function Service (base_url) {

  var thisService = this;

  this.base_url = base_url;

  this.upload_form_data = function (successFn, progressFn, errorFn, formData) {
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
       processData: false,

       // Custom XMLHttpRequest
        xhr: function() {
            var myXhr = $.ajaxSettings.xhr();
            if (myXhr.upload) {
                // For handling the progress of the upload
                myXhr.upload.addEventListener('progress', progressFn, false);
            }
            return myXhr;
        }
     });
   };

  this.get_dataset_schema  = function ( filename, fn, errorFn, params ) {
    $.get( thisService.base_url + "/get_dataset_schema", { filename: filename } )
      .done(function(res){fn(res, params);})
      .fail(errorFn);
  };

  this.append_file_to_dataset  = function ( filename, nextfile, fn, errorFn, params ) {
    $.get( thisService.base_url + "/append_file_to_dataset", { filename: filename, nextfile: nextfile } )
      .done(function(res){fn(res, params);})
      .fail(errorFn);
  };

  this.apply_rmf_file_to_dataset  = function ( filename, rmf_filename, fn ) {
    $.get( thisService.base_url + "/apply_rmf_file_to_dataset", { filename: filename, rmf_filename: rmf_filename } )
      .done(fn)
      .fail(fn);
  };

  this.make_ajax_call = function (callName, data, fn) {
    if (isNull(data.x_values)){
      log(callName + " plot " + JSON.stringify(data));
    } else {
      log(callName + " plot " + JSON.stringify({ x_values: data.x_values.length, models: data.models, estimated: data.estimated }));
    }
    try {
      $.ajax({
         type : "POST",
         url : thisService.base_url + "/" + callName,
         data: JSON.stringify(data, null, '\t'),
         contentType: 'application/json;charset=UTF-8',
         success: fn,
         error: fn
      });
    } catch (e) {
      fn({ "error" : e });
    }
  };

  this.request_plot_data = function (data, fn) {
    thisService.make_ajax_call("get_plot_data", data, fn);
  };

  this.request_histogram = function (data, fn) {
    thisService.make_ajax_call("get_histogram", data, fn);
  };

  this.request_lightcurve = function (data, fn) {
    thisService.make_ajax_call("get_lightcurve", data, fn);
  };

  this.request_divided_lightcurves_from_colors = function (data, fn) {
    thisService.make_ajax_call("get_divided_lightcurves_from_colors", data, fn);
  };

  this.request_joined_lightcurves = function (data, fn) {
    thisService.make_ajax_call("get_joined_lightcurves", data, fn);
  };

  this.request_divided_lightcurve_ds = function (data, fn) {
    thisService.make_ajax_call("get_divided_lightcurve_ds", data, fn);
  };

  this.request_power_density_spectrum = function (data, fn) {
    thisService.make_ajax_call("get_power_density_spectrum", data, fn);
  };

  this.request_dynamical_spectrum = function (data, fn) {
    thisService.make_ajax_call("get_dynamical_spectrum", data, fn);
  };

  this.request_cross_spectrum = function (data, fn) {
    thisService.make_ajax_call("get_cross_spectrum", data, fn);
  };

  this.request_unfolded_spectrum  = function ( data, fn ) {
    thisService.make_ajax_call("get_unfolded_spectrum", data, fn);
  };

  this.request_covariance_spectrum  = function ( data, fn ) {
    thisService.make_ajax_call("get_covariance_spectrum", data, fn);
  };

  this.request_rms_spectrum  = function ( data, fn ) {
    thisService.make_ajax_call("get_rms_spectrum", data, fn);
  };

  this.request_plot_data_from_models  = function ( data, fn ) {
    thisService.make_ajax_call("get_plot_data_from_models", data, fn);
  };

  this.request_fit_powerspectrum_result = function (data, fn) {
    thisService.make_ajax_call("get_fit_powerspectrum_result", data, fn);
  };

  this.request_bootstrap_results  = function ( data, fn ) {
    thisService.make_ajax_call("get_bootstrap_results", data, fn);
  };

  this.subscribe_to_server_messages = function (fn) {
    var evtSrc = new EventSource("/subscribe");
    evtSrc.onmessage = function(e) {
        fn(e.data);
    };
  };

  log("Service ready!");
}
