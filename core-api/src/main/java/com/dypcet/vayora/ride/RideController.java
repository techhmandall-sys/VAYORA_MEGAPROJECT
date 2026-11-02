package com.dypcet.vayora.ride;

import com.dypcet.vayora.identity.CurrentUser;
import com.dypcet.vayora.ride.RideService.Availability;
import com.dypcet.vayora.ride.RideService.Candidate;
import com.dypcet.vayora.ride.RideService.Filters;
import com.dypcet.vayora.vehicle.VehicleService.Comfort;
import com.dypcet.vayora.vehicle.VehicleService.Luggage;
import com.dypcet.vayora.ride.RideService.Membership;
import com.dypcet.vayora.ride.RideService.PublishRide;
import com.dypcet.vayora.ride.RideService.Ride;
import com.dypcet.vayora.ride.RideService.RoutePreview;
import com.dypcet.vayora.ride.RideService.Sort;
import com.dypcet.vayora.ride.RideService.StopInput;
import com.dypcet.vayora.ride.RideService.Stretch;
import com.dypcet.vayora.routing.RouteService.Point;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rides")
public class RideController {

    public record StopRequest(
            @NotBlank @Size(max = 100) String name,
            @DecimalMin("-90") @DecimalMax("90") double lat,
            @DecimalMin("-180") @DecimalMax("180") double lon,
            @Min(0) @Max(2880) int offsetMinutes) {
    }

    public record PublishRideRequest(
            @NotNull Long vehicleId,
            @NotNull Instant departureTime,
            @Min(1) @Max(8) int seatsOffered,
            boolean instantBooking,
            @NotNull @Size(min = 2, max = 10) List<@Valid @NotNull StopRequest> stops,
            @NotNull @Size(min = 1, max = 9)
            List<@NotNull @DecimalMin("0") @Digits(integer = 6, fraction = 2) BigDecimal>
                    segmentPrices,
            @Size(max = 500) String notes,
            boolean maxTwoInBack,
            Instant returnDepartureTime,
            @Min(0) @Max(8) int repeatWeeks,
            boolean womenOnly,
            // Minutes in all the driver will go out of their way for pickups; null is none.
            Integer maxDetourMinutes) {
    }

    public record PointRequest(
            @DecimalMin("-90") @DecimalMax("90") double lat,
            @DecimalMin("-180") @DecimalMax("180") double lon) {
    }

    public record RoutePreviewRequest(
            @NotNull @Size(min = 2, max = 10) List<@Valid @NotNull PointRequest> stops) {
    }

    public record LastMileSelectedRequest(@NotBlank @Pattern(regexp = "walk|rickshaw|bus") String mode) {
    }

    private final RideService rides;

    public RideController(RideService rides) {
        this.rides = rides;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('DRIVER')")
    public Ride publish(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody PublishRideRequest request) {
        List<StopInput> stops = request.stops().stream()
                .map(s -> new StopInput(s.name(), s.lat(), s.lon(), s.offsetMinutes()))
                .toList();
        return rides.publish(CurrentUser.id(jwt), new PublishRide(request.vehicleId(),
                request.departureTime(), request.seatsOffered(), request.instantBooking(),
                stops, request.segmentPrices(), request.notes(), request.maxTwoInBack(),
                request.returnDepartureTime(), request.repeatWeeks(), request.womenOnly(),
                request.maxDetourMinutes() == null ? 0 : request.maxDetourMinutes()));
    }

    /** The road route through some stops and a suggested price per leg, before publishing. */
    @PostMapping("/route-preview")
    @PreAuthorize("hasRole('DRIVER')")
    public RoutePreview preview(@Valid @RequestBody RoutePreviewRequest request) {
        return rides.preview(request.stops().stream()
                .map(stop -> new Point(stop.lat(), stop.lon())).toList());
    }

    @GetMapping("/search")
    public List<Candidate> search(@AuthenticationPrincipal Jwt jwt,
            @RequestParam @DecimalMin("-90") @DecimalMax("90") double originLat,
            @RequestParam @DecimalMin("-180") @DecimalMax("180") double originLon,
            @RequestParam @DecimalMin("-90") @DecimalMax("90") double destLat,
            @RequestParam @DecimalMin("-180") @DecimalMax("180") double destLon,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "1") @Min(1) @Max(8) int seats,
            @RequestParam(defaultValue = "TIME") Sort sort,
            @RequestParam(required = false) @Min(0) @Max(23) Integer earliestHour,
            @RequestParam(required = false) @Min(1) @Max(24) Integer latestHour,
            @RequestParam(required = false) @DecimalMin("0") BigDecimal maxPrice,
            @RequestParam(defaultValue = "false") boolean instantOnly,
            @RequestParam(defaultValue = "false") boolean confirmedDriver,
            @RequestParam(defaultValue = "false") boolean idCheckedDriver,
            @RequestParam(defaultValue = "false") boolean smokeFree,
            @RequestParam(defaultValue = "false") boolean petsWelcome,
            @RequestParam(defaultValue = "false") boolean maxTwoInBack,
            @RequestParam(defaultValue = "false") boolean womenOnly,
            @RequestParam(required = false) @DecimalMin("0") BigDecimal minPrice,
            @RequestParam(defaultValue = "false") boolean musicWelcome,
            @RequestParam(defaultValue = "false") boolean quietRide,
            @RequestParam(required = false) Comfort comfortAtLeast,
            @RequestParam(required = false) Luggage luggageAtLeast) {
        return rides.search(CurrentUser.id(jwt), new Point(originLat, originLon),
                new Point(destLat, destLon), date, seats, sort,
                new Filters(earliestHour, latestHour, maxPrice, instantOnly, confirmedDriver,
                        smokeFree, petsWelcome, maxTwoInBack, womenOnly, minPrice, musicWelcome,
                        quietRide, comfortAtLeast, luggageAtLeast, idCheckedDriver));
    }

    /**
     * Seats left now on stretches of rides, for a screen keeping its results current, each given
     * as {@code rideId:fromSeq:toSeq}. Records nothing, unlike a search.
     */
    @GetMapping("/availability")
    public List<Availability> availability(@AuthenticationPrincipal Jwt jwt,
            @RequestParam @Size(min = 1, max = 30) List<@Pattern(regexp = "\\d{1,18}:\\d{1,4}:\\d{1,4}") String> stretch) {
        return rides.availability(CurrentUser.id(jwt), stretch.stream().map(given -> {
            String[] parts = given.split(":");
            return new Stretch(Long.parseLong(parts[0]), Integer.parseInt(parts[1]), Integer.parseInt(parts[2]));
        }).toList());
    }

    @GetMapping("/mine")
    @PreAuthorize("hasRole('DRIVER')")
    public List<Ride> mine(@AuthenticationPrincipal Jwt jwt) {
        return rides.publishedBy(CurrentUser.id(jwt));
    }

    @GetMapping("/{id}/membership")
    public Membership membership(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return rides.membership(CurrentUser.id(jwt), id);
    }

    @GetMapping("/{id}")
    public Ride get(@PathVariable long id) {
        return rides.get(id);
    }

    /**
     * A passenger tapped a last-mile access option shown with a search result (feature
     * 91's walk, or a rickshaw estimate). Opens nothing: this is telemetry only.
     */
    @PostMapping("/{id}/last-mile-selected")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void lastMileSelected(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
            @Valid @RequestBody LastMileSelectedRequest request) {
        rides.lastMileOptionSelected(CurrentUser.id(jwt), id, request.mode());
    }
}
