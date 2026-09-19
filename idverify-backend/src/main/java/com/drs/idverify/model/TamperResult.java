package com.drs.idverify.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "tamper_results")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TamperResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private CaseEntity caseEntity;

    @Column(name = "ela_score")
    private Integer elaScore; // 0 - 100

    @Column(name = "metadata_score")
    private Integer metadataScore; // 0 - 100

    @Column(name = "region_consistency_score")
    private Integer regionConsistencyScore; // 0 - 100

    @Column(name = "overall_tamper_confidence")
    private Integer overallTamperConfidence; // 0 - 100

    @Column(name = "heatmap_image_path")
    private String heatmapImagePath;

    @Column(name = "heatmap_b64", columnDefinition = "LONGTEXT")
    private String heatmapB64;

    @Column(name = "exif_flags", columnDefinition = "LONGTEXT")
    private String exifFlags; // JSON string

    @Column(columnDefinition = "LONGTEXT")
    private String hotspots; // JSON array of bounding boxes & labels
}
