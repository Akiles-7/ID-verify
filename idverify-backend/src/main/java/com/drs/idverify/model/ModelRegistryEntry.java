package com.drs.idverify.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "model_registry")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ModelRegistryEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String module; // OCR, TAMPER, FACE, LIVENESS

    @Column(name = "model_name", nullable = false, length = 80)
    private String modelName;

    @Column(nullable = false, length = 30)
    private String version;

    @Column(nullable = false, length = 40)
    private String framework;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "avg_latency_ms")
    private Integer avgLatencyMs;

    @Column(length = 255)
    private String notes;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PreUpdate
    @PrePersist
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
