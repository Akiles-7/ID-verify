package com.drs.idverify.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "validation_checks")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ValidationCheck {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private CaseEntity caseEntity;

    @Column(name = "check_group", nullable = false, length = 30)
    private String checkGroup; // MRZ, CHECKSUM, FORMAT, DATE_LOGIC

    @Column(name = "check_name", nullable = false, length = 120)
    private String checkName;

    @Column(nullable = false)
    private Boolean passed;

    @Column(name = "computed_value", length = 255)
    private String computedValue;

    @Column(name = "stored_value", length = 255)
    private String storedValue;

    @Column(length = 1000)
    private String detail;
}
