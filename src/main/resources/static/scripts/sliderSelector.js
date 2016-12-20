
function sliderSelector(id, title, fromLabel, toLabel, fromValue, toValue) {

  var currentObj = this;
  this.id = id;
  this.title = title;
  this.fromLabel = fromLabel;
  this.toLabel = toLabel;
  this.fromValue = fromValue;
  this.toValue = toValue;

  this.$html = $('<div class="sliderSelector ' + this.id + '">' +
                  '<h3>' + title + '</h3>' +
                  '<input id="from_' + this.id + '" type="text" name="from_' + this.id + '" placeholder="' + fromLabel + '">' +
                  '<input id="to_' + this.id + '" type="text" name="to_' + this.id + '" placeholder="' + toLabel + '" >' +
                  '<div id="slider-' + this.id + '"></div>' +
                '</div>');

  //Creates the slider
  this.$html.find("#slider-" + this.id).slider({
         range:true,
         min: currentObj.fromValue,
         max: currentObj.toValue,
         values: [ fromValue, toValue ],
         slide: function( event, ui ) {
            currentObj.setValues( ui.values[ 0 ], ui.values[ 1 ]);
         }
     });

   //Set values method
   this.setValues = function (from, to) {
     this.$html.find("#from_" + this.id).val( from );
     this.$html.find("#to_" + this.id).val( to );
   }
   this.setValues( this.fromValue, this.toValue );

   log ("new sliderSelector id: " + id + ", fromValue: " + fromValue + ", toValue: " + toValue);

   return this;
}
