window.HELP_IMPROVE_VIDEOJS = false;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize carousel with explicit settings
    var carousel = bulmaCarousel.attach('#video-carousel', {
        slidesToShow: 1,
        slidesToScroll: 1,
        loop: true,
        infinite: true,
        autoplay: false,
        duration: 300,
        pagination: true
    })[0];

    // Add video pause handling
    if (carousel) {
        carousel.on('before:show', () => {
            const videos = document.querySelectorAll('.carousel video');
            videos.forEach(video => {
                video.pause();
                video.currentTime = 0;
            });
        });
    }
});

// Add global error handler
window.onerror = function(msg, url, line) {
    console.error('JavaScript error:', msg);
    console.error('File:', url);
    console.error('Line:', line);
};
