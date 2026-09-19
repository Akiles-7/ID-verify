# IDVerify — clean Windows setup

This project is now intended to be run from three terminals: AI service, Spring Boot, and React.

## 0. Use a clean Python environment

Use **64-bit Python 3.11** for the AI service. Do not reuse the old `.venv` from the ZIP.

```powershell
cd idverify-ai-service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

## 1. Install PaddlePaddle CPU first

PaddlePaddle publishes an official Windows CPU wheel. Install it before the rest of the AI requirements:

```powershell
python -m pip install paddlepaddle==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
python -m pip install -r requirements.txt
```

Verify:

```powershell
python -c "import paddle; print(paddle.__version__); paddle.utils.run_check()"
python -c "from paddleocr import PaddleOCR; print('PaddleOCR import OK')"
```

The official PaddlePaddle Windows instructions currently list Python 3.9–3.13 and provide the CPU 3.3.0 wheel. PaddleOCR 3.x uses the `PaddleOCR(...).predict(...)` API used by this project. 

## 2. Start AI service

```powershell
cd idverify-ai-service
.\.venv\Scripts\Activate.ps1
python main.py
```

Then open:

`http://localhost:8000/health`

The response should show:

- `primary_ocr_engine: PaddleOCR`
- `paddleocr_available: true`
- `status: READY` for OCR

If PaddleOCR is unavailable, **do not continue pretending it is active**. Fix the Python environment first.

## 3. Start Spring Boot

Make sure Java 17 and Maven are installed.

```powershell
cd idverify-backend
mvn clean spring-boot:run
```

The local configuration defaults to an H2 file database. For MySQL, set:

```powershell
$env:SPRING_DATASOURCE_URL="jdbc:mysql://localhost:3306/idverify_db?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
$env:SPRING_DATASOURCE_USERNAME="root"
$env:SPRING_DATASOURCE_PASSWORD="YOUR_PASSWORD"
$env:AI_SERVICE_URL="http://localhost:8000"
$env:JWT_SECRET="replace-with-a-long-random-secret"
```

## 4. Start React

Use a clean Node dependency installation. Do not reuse the `node_modules` directory that came from another operating system.

```powershell
cd idverify-frontend
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm install
npm run dev
```

Open the URL Vite prints, normally:

`http://localhost:5173`

## 5. First functional test

Before testing a real passport:

1. Open `/health` on port 8000.
2. Log into the React application.
3. Upload a clear passport image.
4. Capture/upload the selfie.
5. Run the scan.
6. Check the Processing Console.
7. Check OCR fields.
8. Check the browser Network tab for `POST /api/scan`.
9. Check Spring Boot logs for the AI response.
10. Check the case result from `GET /api/scan/{caseId}/result`.

A missing OCR field must remain blank/unknown. The backend must never replace a missing date with today's date and must never create a synthetic identity result when the AI service fails.
