package com.dypcet.vayora.photo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dypcet.vayora.PostgresIntegrationTest;
import com.dypcet.vayora.identity.IdentityService;
import com.dypcet.vayora.identity.TokenService;
import com.dypcet.vayora.identity.UserRole;
import com.dypcet.vayora.vehicle.VehicleService;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.zip.CRC32;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class PhotoIntegrationTest extends PostgresIntegrationTest {

    private static final String SECRET = "GPS 16.70500 74.24330 home";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private IdentityService identity;

    @Autowired
    private TokenService tokens;

    @Autowired
    private VehicleService vehicles;

    @Test
    void aProfilePhotoIsStoredAsAScaledJpegWithNothingElseTheFileCarried() throws Exception {
        long member = user(UserRole.PASSENGER);
        String auth = bearer(member, UserRole.PASSENGER);

        mvc.perform(put("/api/v1/me/photo").header("Authorization", auth).contentType("image/png")
                        .content(pngWithText(2000, 1000, SECRET)))
                .andExpect(status().isNoContent());

        byte[] stored = mvc.perform(get("/api/v1/users/" + member + "/photo")
                        .header("Authorization", bearer(user(UserRole.DRIVER), UserRole.DRIVER)))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/jpeg"))
                .andReturn().getResponse().getContentAsByteArray();
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(stored));
        assertThat(image.getWidth()).isEqualTo(800);
        assertThat(image.getHeight()).isEqualTo(400);
        assertThat(new String(stored, StandardCharsets.ISO_8859_1)).doesNotContain("GPS").doesNotContain("home");

        mvc.perform(delete("/api/v1/me/photo").header("Authorization", auth)).andExpect(status().isNoContent());
        // No photo is nothing to send, not an error a browser would log.
        mvc.perform(get("/api/v1/users/" + member + "/photo").header("Authorization", auth))
                .andExpect(status().isNoContent());
    }

    @Test
    void somethingThatIsNotAPhotoOrIsTooLargeIsRefused() throws Exception {
        String auth = bearer(user(UserRole.PASSENGER), UserRole.PASSENGER);

        mvc.perform(put("/api/v1/me/photo").header("Authorization", auth).contentType("image/jpeg")
                        .content("<script>not a photo</script>".getBytes(StandardCharsets.UTF_8)))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/v1/me/photo").header("Authorization", auth).contentType("image/jpeg")
                        .content(new byte[5 * 1024 * 1024 + 1]))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void onlyTheOwnerChangesAVehiclePhotoAndAnyMemberSeesIt() throws Exception {
        long owner = user(UserRole.DRIVER);
        long vehicleId = vehicles.create(owner, "Maruti", "Ertiga", 2022, "Silver", 7).id();
        String stranger = bearer(user(UserRole.DRIVER), UserRole.DRIVER);
        byte[] photo = pngWithText(400, 300, "plain");

        mvc.perform(put("/api/v1/vehicles/" + vehicleId + "/photo").header("Authorization", stranger)
                        .contentType("image/png").content(photo))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/v1/vehicles/" + vehicleId + "/photo").header("Authorization", bearer(owner, UserRole.DRIVER))
                        .contentType("image/png").content(photo))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/vehicles/" + vehicleId + "/photo").header("Authorization", stranger))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/vehicles/" + vehicleId + "/photo")).andExpect(status().isUnauthorized());
    }

    /** A real PNG, with a text chunk such as a camera or editor might add. */
    private static byte[] pngWithText(int width, int height, String text) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        byte[] png = out.toByteArray();

        byte[] data = ("Comment\0" + text).getBytes(StandardCharsets.ISO_8859_1);
        byte[] type = "tEXt".getBytes(StandardCharsets.US_ASCII);
        CRC32 crc = new CRC32();
        crc.update(type);
        crc.update(data);
        ByteBuffer chunk = ByteBuffer.allocate(12 + data.length).putInt(data.length).put(type).put(data)
                .putInt((int) crc.getValue());
        // After the 8-byte signature and the 25-byte header chunk.
        ByteArrayOutputStream withText = new ByteArrayOutputStream();
        withText.write(png, 0, 33);
        withText.write(chunk.array());
        withText.write(png, 33, png.length - 33);
        byte[] result = withText.toByteArray();
        assertThat(new String(result, StandardCharsets.ISO_8859_1)).contains(text);
        return result;
    }

    private long user(UserRole role) {
        return identity.register(UUID.randomUUID() + "@example.test", "correct-horse-battery", "Test " + role, role).id();
    }

    private String bearer(long id, UserRole role) {
        return "Bearer " + tokens.issue(id, role);
    }
}
