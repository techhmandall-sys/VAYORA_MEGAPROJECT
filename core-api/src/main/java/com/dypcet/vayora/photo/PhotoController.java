package com.dypcet.vayora.photo;

import com.dypcet.vayora.identity.CurrentUser;
import com.dypcet.vayora.photo.PhotoService.Owner;
import com.dypcet.vayora.vehicle.VehicleService;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.unit.DataSize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Photos are sent as the image itself in the request body. Any signed-in member may see a
 * member's or a vehicle's photo, as they may see the profile and the vehicle; only the
 * member, or the vehicle's owner, may change it.
 */
@RestController
@RequestMapping("/api/v1")
public class PhotoController {

    private final PhotoService photos;
    private final VehicleService vehicles;
    private final long maxUploadBytes;

    public PhotoController(PhotoService photos, VehicleService vehicles,
            @Value("${vayora.photo.max-upload}") DataSize maxUpload) {
        this.photos = photos;
        this.vehicles = vehicles;
        this.maxUploadBytes = maxUpload.toBytes();
    }

    @GetMapping("/users/{id}/photo")
    public ResponseEntity<byte[]> userPhoto(@PathVariable long id) {
        return jpeg(photos.get(Owner.USER, id));
    }

    @PutMapping("/me/photo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void putMine(@AuthenticationPrincipal Jwt jwt, HttpServletRequest request) throws IOException {
        photos.put(Owner.USER, CurrentUser.id(jwt), body(request));
    }

    @DeleteMapping("/me/photo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMine(@AuthenticationPrincipal Jwt jwt) {
        photos.remove(Owner.USER, CurrentUser.id(jwt));
    }

    @GetMapping("/vehicles/{id}/photo")
    public ResponseEntity<byte[]> vehiclePhoto(@PathVariable long id) {
        return jpeg(photos.get(Owner.VEHICLE, id));
    }

    @PutMapping("/vehicles/{id}/photo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void putVehicle(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, HttpServletRequest request)
            throws IOException {
        owned(jwt, id);
        photos.put(Owner.VEHICLE, id, body(request));
    }

    @DeleteMapping("/vehicles/{id}/photo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeVehicle(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        owned(jwt, id);
        photos.remove(Owner.VEHICLE, id);
    }

    /** Someone else's vehicle is answered as if it did not exist. */
    private void owned(Jwt jwt, long vehicleId) {
        if (vehicles.findOwned(vehicleId, CurrentUser.id(jwt)) == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found");
        }
    }

    /** At most one byte past the limit is read, so an oversized upload is refused without being held whole. */
    private byte[] body(HttpServletRequest request) throws IOException {
        return request.getInputStream().readNBytes((int) Math.min(Integer.MAX_VALUE - 8, maxUploadBytes + 1));
    }

    private static ResponseEntity<byte[]> jpeg(byte[] photo) {
        // No photo yet is nothing to send, not an error: a 404 here was logged by every browser as one,
        // on each page that shows initials instead.
        if (photo == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate()).body(photo);
    }
}
