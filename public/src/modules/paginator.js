"use strict";

/* globals app, define, utils, config, ajaxify, Sly */

define('paginator', ['forum/pagination'], function(pagination) {
	var paginator = {},
		frame,
		scrollbar,
		animationTimeout = null,
		index, previousIndex,
		count;
	
	paginator.init = function() {
		var options = {
			scrollBy: 200,
			speed: 200,
			easing: 'easeOutQuart',
			scrollBar: '#scrollbar',
			dynamicHandle: 1,
			dragHandle: 1,
			clickBar: 1,
			mouseDragging: 1,
			touchDragging: 1,
			releaseSwing: 1
		};
		
		frame = new Sly('#frame', options);
		frame.init();
		scrollbar = $('#scrollbar');

		$('html').addClass('paginated'); // allows this to work for non-JS browsers

		//todo key-bindings

		$(window).on('resize action:ajaxify.end', adjustContentLength);

		frame.on('moveEnd', hideScrollbar);
		scrollbar.on('mouseout', hideScrollbar);

		frame.on('moveStart', showScrollbar);
		scrollbar.on('mouseover', showScrollbar);

		hideScrollbar();
	};

	paginator.reload = function() {
		frame.reload();
	};

	paginator.scrollToPost = function(postIndex, highlight, duration, offset) {
		if (!utils.isNumber(postIndex)) {
			return;
		}

		offset = offset || 0;
		duration = duration !== undefined ? duration : 400;
		paginator.scrollActive = true;

		if($('#post_anchor_' + postIndex).length) {
			return scrollToPid(postIndex, highlight, duration, offset);
		}

		if (config.usePagination) {
			if (window.location.search.indexOf('page') !== -1) {
				paginator.update();
				return;
			}

			var page = Math.ceil((postIndex + 1) / config.postsPerPage);

			if(parseInt(page, 10) !== pagination.currentPage) {
				pagination.loadPage(page, function() {
					scrollToPid(postIndex, highlight, duration, offset);
				});
			} else {
				scrollToPid(postIndex, highlight, duration, offset);
			}
		} else {
			paginator.scrollActive = false;
			postIndex = parseInt(postIndex, 10) + 1;
			ajaxify.go(generateUrl(postIndex));
		}
	};

	paginator.setCount = function(value) {
		count = parseInt(value, 10);
		updateTextAndProgressBar();
	};

	paginator.scrollTop = function(index) {
		if ($('li[data-index="' + index + '"]').length) {
			paginator.scrollToPost(index, true);
		} else {
			ajaxify.go(generateUrl());
		}
	};

	paginator.scrollBottom = function(index) {
		if (parseInt(index, 10) < 0) {
			return;
		}
		if ($('li[data-index="' + index + '"]').length) {
			paginator.scrollToPost(index, true);
		} else {
			index = parseInt(index, 10) + 1;
			ajaxify.go(generateUrl(index));
		}
	};

	//look into calculateIndex
	paginator.setup = function(selector, count, toTop, toBottom, callback, calculateIndex) {
		index = 1;
		paginator.selector = selector;
		paginator.callback = callback;
		toTop = toTop || function() {};
		toBottom = toBottom || function() {};

		paginator.disableForwardLoading = false;
		paginator.disableReverseLoading = false;

		$(window).on('scroll', paginator.update);
		paginator.setCount(count);

		adjustContentLength();
	};

	var throttle = Date.now();
	paginator.update = function() {
		if ((Date.now() - throttle) < 2000) {
			return;
		}

		throttle = Date.now();

		var elements = $(paginator.selector).get();

		if (index > count / 2) {
			elements = elements.reverse();
		}

		$(elements).each(function() {
			var el = $(this);

			if (elementInView(el)) {
				if (typeof paginator.callback === 'function') {
					index = parseInt(el.attr('data-index'), 10) + 1;
					if (previousIndex && !paginator.scrollActive) {
						var abs = Math.abs(index - previousIndex);

						if (abs > 1) {
							index = previousIndex + ((index - previousIndex) / abs);
						}
					}

					previousIndex = index;
					paginator.callback(el, index, count);
					updateTextAndProgressBar();
				}

				return false;
			}
		});
	};

	paginator.onScroll = function(cb) {
		var prevPos = frame.pos.cur,
			throttle = Date.now();
		
		frame.on('move', function(ev) {
			if ((Date.now() - throttle) < 250) {
				return;
			}

			throttle = Date.now();

			paginator.update();

			var curPos = frame.pos.cur,
				destPos = frame.pos.dest,
				el;

			if (curPos === frame.pos.end || destPos === frame.pos.end) {
				paginator.disableForwardLoading = true;
			}

			if (curPos === 0 || destPos === 0) {
				paginator.disableReverseLoading = true;
			}

			if (prevPos < curPos && !paginator.disableForwardLoading) {
				el = $($(paginator.selector).get(-10));
				if (elementInView(el)) {
					cb(1, function() {
						el.nextAll('.infinite-spacer').first().remove();
						adjustContentLength();
					});
				}
			} else if (prevPos > curPos && !paginator.disableReverseLoading) {
				el = $($(paginator.selector).get(10));
				if (elementInView(el)) {
					cb(-1, function() {
						el.prevAll('.infinite-spacer').first().remove();
						adjustContentLength();
					});
				}
			}
			
			prevPos = curPos;
		});

		frame.on('moveEnd', function(ev) {
			
		});
	};

	function generateUrl(index) {
		var parts = window.location.pathname.split('/');
		return parts[1] + '/' + parts[2] + '/' + parts[3] + (index ? '/' + index : '');
	}

	function updateTextAndProgressBar() {
		index = index > count ? count : index;
		$('#pagination').translateHtml('[[global:pagination.out_of, ' + index + ', ' + count + ']]');
	}

	function elementInView(el) {
		var scrollTop = $(window).scrollTop() + $('#header-menu').height();
		var scrollBottom = scrollTop + $(window).height();

		var elTop = el.offset().top;
		var elBottom = elTop + Math.floor(el.height());
		return (elTop >= scrollTop && elBottom <= scrollBottom) || (elTop <= scrollTop && elBottom >= scrollTop);
	}

	function scrollToPid(postIndex, highlight, duration, offset) {
		var scrollTo = $('#post_anchor_' + postIndex);

		if (!scrollTo) {
			paginator.scrollActive = false;
			return;
		}

		var done = false;
		function animateScroll() {
			//todo, ask baris about duration

			frame.slideTo(scrollTo.offset().top - $('#header-menu').height() - offset);
			frame.one('moveEnd', function() {
				if (done) {
					return;
				}
				done = true;

				paginator.scrollActive = false;
				paginator.update();
				highlightPost();

				// what is this for
				$('body').scrollTop($('body').scrollTop() - 1);
				$('html').scrollTop($('html').scrollTop() - 1);
			});
		}

		function highlightPost() {
			if (highlight) {
				scrollTo.parent().find('.topic-item').addClass('highlight');
				setTimeout(function() {
					scrollTo.parent().find('.topic-item').removeClass('highlight');
				}, 3000);
			}
		}

		if ($('#post-container').length) {
			animateScroll();
		}
	}

	function hideScrollbar() {
		clearTimeout(animationTimeout);
		animationTimeout = setTimeout(function() {
			scrollbar.addClass('translucent');
		}, 3000);
	}

	function showScrollbar() {
		clearTimeout(animationTimeout);
		scrollbar.removeClass('translucent');
	}

	function adjustContentLength() {
		var items = $(paginator.selector).length,
			content = $('#content'),
			currentHeight = 0;

		var spacer = $('<div class="infinite-spacer"></div>'),
			lastIndex = 0;

		$(paginator.selector).each(function() {
			var el = $(this),
				index = parseInt(el.attr('data-index'), 10);

			if ((lastIndex + 1) !== index && index !== 0) {
				var amountOfPages = Math.ceil((index - lastIndex) / config.postsPerPage);

				for (var x = amountOfPages; x > 0; x--) {
					var page = Math.ceil(index / config.postsPerPage) - x;

					if (!$('.infinite-spacer[data-page="' + page + '"]').length) {
						spacer.clone()
							.attr('data-page', page)
							.insertBefore(el);
					}
				}
			}

			lastIndex = index;

			currentHeight += el.outerHeight();
		});

		var height = items !== count ? ((currentHeight / items) * count) + (count / items * 1000) : content.height(),
			spacerHeight = height / items + (count / items * 1000);

		content.css('min-height', height - ($('.infinite-spacer').length * spacerHeight));
		$('.infinite-spacer').height(spacerHeight);

		paginator.update();
		paginator.reload();
	}

	return paginator;
});
