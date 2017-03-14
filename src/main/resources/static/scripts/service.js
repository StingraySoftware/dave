
function Service (base_url) {

  var thisService = this;

  this.base_url = base_url;

  this.upload_form_data = function (successFn, errorFn, formData) {
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
    try {
      $.ajax({
         type : "POST",
         url : thisService.base_url + "/get_lightcurve",
         data: JSON.stringify(lc_data, null, '\t'),
         contentType: 'application/json;charset=UTF-8',
         success: fn,
         error: fn
      });
    } catch (e) {
      fn({ "error" : e });
    }
  };

  this.request_colors_lightcurve = function (lc_data, fn) {
    log("request_colors_lightcurve plot " + JSON.stringify(lc_data));
    try {
      $.ajax({
         type : "POST",
         url : thisService.base_url + "/get_colors_lightcurve",
         data: JSON.stringify(lc_data, null, '\t'),
         contentType: 'application/json;charset=UTF-8',
         success: fn,
         error: fn
      });
    } catch (e) {
      fn({ "error" : e });
    }
  };

  this.request_joined_lightcurves_from_colors = function (data, fn) {
    log("request_joined_lightcurves_from_colors plot " + JSON.stringify(data));
    try {
      $.ajax({
         type : "POST",
         url : thisService.base_url + "/get_joined_lightcurves_from_colors",
         data: JSON.stringify(data, null, '\t'),
         contentType: 'application/json;charset=UTF-8',
         success: fn,
         error: fn
      });
    } catch (e) {
      fn({ "error" : e });
    }
  };

  this.request_joined_lightcurves = function (lc_data, fn) {
    log("request_joined_lightcurves plot " + JSON.stringify(lc_data));
    try {
      $.ajax({
         type : "POST",
         url : thisService.base_url + "/get_joined_lightcurves",
         data: JSON.stringify(lc_data, null, '\t'),
         contentType: 'application/json;charset=UTF-8',
         success: fn,
         error: fn
      });
    } catch (e) {
      fn({ "error" : e });
    }
  };

  this.request_divided_lightcurve_ds = function (data, fn) {
    log("request_divided_lightcurve_ds: " + JSON.stringify(data));
    try {
      $.ajax({
         type : "POST",
         url : thisService.base_url + "/get_divided_lightcurve_ds",
         data: JSON.stringify(data, null, '\t'),
         contentType: 'application/json;charset=UTF-8',
         success: fn,
         error: fn
      });
    } catch (e) {
      fn({ "error" : e });
    }
  };

  this.request_power_density_spectrum = function (data, fn) {
    log("request_power_density_spectrum plot " + JSON.stringify(data));
    try {
      $.ajax({
         type : "POST",
         url : thisService.base_url + "/get_power_density_spectrum",
         data: JSON.stringify(data, null, '\t'),
         contentType: 'application/json;charset=UTF-8',
         success: fn,
         error: fn
      });
    } catch (e) {
      fn({ "error" : e });
    }
  };

  this.subscribe_to_server_messages = function (fn) {
    var evtSrc = new EventSource("/subscribe");
    evtSrc.onmessage = function(e) {
        fn(e.data);
    };
  };

  log("Service ready!");
}
