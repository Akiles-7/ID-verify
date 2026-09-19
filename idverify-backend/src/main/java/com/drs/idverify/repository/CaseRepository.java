package com.drs.idverify.repository;

import com.drs.idverify.model.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface CaseRepository extends JpaRepository<CaseEntity, Long> {
    Optional<CaseEntity> findByCaseCode(String caseCode);
    boolean existsByCaseCode(String caseCode);

    @Query("SELECT c.caseCode FROM CaseEntity c WHERE c.caseCode IS NOT NULL")
    List<String> findAllCaseCodes();

    List<CaseEntity> findTop6ByOrderByCreatedAtDesc();
    
    @Query("SELECT c FROM CaseEntity c WHERE " +
           "(:filter = 'ALL' OR c.status = :filter) AND " +
           "(:search IS NULL OR LOWER(c.subjectName) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(c.caseCode) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<CaseEntity> findFilteredCases(@Param("filter") String filter, @Param("search") String search, Pageable pageable);

    long countByCreatedAtAfter(LocalDateTime date);
    long countByCreatedAtBetween(LocalDateTime from, LocalDateTime to);
    long countByStatusAndCreatedAtAfter(String status, LocalDateTime date);
    long countByStatusAndCreatedAtBetween(String status, LocalDateTime from, LocalDateTime to);
    long countByRiskBandAndCreatedAtAfter(String riskBand, LocalDateTime date);
    long countByRiskBandAndCreatedAtBetween(String riskBand, LocalDateTime from, LocalDateTime to);
    List<CaseEntity> findByCreatedAtAfter(LocalDateTime date);
}
