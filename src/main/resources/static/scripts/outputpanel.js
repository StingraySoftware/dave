function OutputPanel (classSelector) {

  var currentObj = this;

  this.classSelector = classSelector;
  this.$html = $(this.classSelector);

  this.resize = function() {

     var plots = currentObj.$html.find(".plotContainer");

     //Sets plots height
     plots.height($(window).height() * 0.5);

     var update = {
       width:plots.width(),
       height:plots.height()-20
     };

     plots.each(function () {
       try {
         var plot = $(this).find("*").toArray();
         Plotly.relayout(plot[2].getAttribute("id"), update);
       } catch (ex) {
         log("Resize plot error: " + ex);
       }
     });
   }
  $(window).resize(this.resize).trigger("resize");

  this.$html.find(".btnHidePlot").bind("click", function(event){
     $("#" + event.target.id).parent().parent().hide();
  });

  this.onDatasetValuesChanged = function ( filename, filters ) {

    log("onDatasetValuesChanged:" + filename + ", filters: " + JSON.stringify(filters) );

    $.get( DOMAIN_URL + "/get_plot_html", { filename: filename,
                                            filters: filters,
                                            styles: { type: "2d", labels: ["Time", "Rate"] },
                                            axis: ["Time", "Rate"] })
    .done(function( plot_html ) {

      currentObj.$html.find(".plotContainer")[0].html(plot_html);

    }).error(function( error ) {
      log("onDatasetValuesChanged:" + error);
    });

  }

 }
