import { useRef, useImperativeHandle, forwardRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  getDataUrl: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

interface SignaturePadProps {
  height?: number;
}

/** Drawn-signature canvas with a clear button. Returns a PNG data URL. */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ height = 140 }, ref) => {
    const sigRef = useRef<SignatureCanvas | null>(null);

    useImperativeHandle(ref, () => ({
      getDataUrl: () => {
        if (!sigRef.current || sigRef.current.isEmpty()) return null;
        return sigRef.current.toDataURL("image/png");
      },
      clear: () => sigRef.current?.clear(),
      isEmpty: () => sigRef.current?.isEmpty() ?? true,
    }));

    return (
      <div className="space-y-2">
        <div
          className="rounded-md border border-input bg-background"
          style={{ height }}
        >
          <SignatureCanvas
            ref={sigRef}
            canvasProps={{
              className: "w-full h-full rounded-md",
              style: { width: "100%", height: "100%" },
            }}
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => sigRef.current?.clear()}
            className="gap-1"
          >
            <Eraser className="h-3 w-3" />
            Clear
          </Button>
        </div>
      </div>
    );
  }
);
SignaturePad.displayName = "SignaturePad";
