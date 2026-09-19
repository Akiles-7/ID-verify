package com.drs.idverify.service;

import com.drs.idverify.model.AuditLog;
import com.drs.idverify.model.CaseEntity;
import com.drs.idverify.model.User;
import com.drs.idverify.repository.AuditLogRepository;
import com.drs.idverify.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    public AuditLogService(AuditLogRepository auditLogRepository, UserRepository userRepository) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
    }

    public void log(String actionType, Long userId, CaseEntity caseEntity, String ipAddress, String detail) {
        User user = userId != null ? userRepository.findById(userId).orElse(null) : null;
        AuditLog auditLog = AuditLog.builder()
                .actionType(actionType)
                .user(user)
                .caseEntity(caseEntity)
                .ipAddress(ipAddress != null ? ipAddress : "127.0.0.1")
                .detail(detail)
                .build();
        auditLogRepository.save(auditLog);
    }
}
