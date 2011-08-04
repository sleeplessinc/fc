/* vim: set ts=2: */

$( document ).ready( function() {
	var padVisible = bcVisible = true;

	var editor	= $( '#editor' );
	var bc			= $( '#sidebar' );

	$( '#togglePad' ).click( function() {
		if( padVisible ) {
			// hide pad and, if bc is visible, grow it
			editor.toggle();

			if( bcVisible ) {
				bc.css( 'width', '100%' );
			}

			padVisible = false;
		} else {
			editor.toggle();

			if( bcVisible ) {
				bc.css( 'width', '30%' );

				editor.css( 'width', '70%' );
			} else {
				editor.css( 'width', '100%' );
			}

			padVisible = true;
		}
	});

	$( '#toggleBC' ).click( function() {
		if( bcVisible ) {
			bc.toggle();

			if( padVisible ) {
				editor.css( 'width', '100%' );
			}

			bcVisible = false;
		} else {
			bc.toggle();

			if( padVisible ) {
				editor.css( 'width', '70%' );

				bc.css( 'width', '30%' );
			} else {
				bc.css( 'width', '100%' );
			}

			bcVisible = true;
		}
	});
});
